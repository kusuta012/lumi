import sharp from "sharp";
import "dotenv/config";
import { execa } from "execa";
import ffmpegPath from "ffmpeg-static";
import { path as ffprobePath } from "ffprobe-static";
import exifReader from "exif-reader";
import { BUCKET_NAME, getStorageClient } from "@/lib/storage";
import { db } from "@/db";
import { faces, media, mediaTags, tags, users, people } from "@/db/schema";
import { eq, sql, and, ne } from "drizzle-orm";
import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import os from "os";
import { redisCache } from "@/lib/cache";
import crypto from "crypto";
import { env } from "@/lib/env"
import { thumbnailQueue, aiQueue } from "@/lib/queue";

sharp.concurrency(2);
sharp.cache({ items: 50, memory: 100 });

function dmsToDecimal(dms: number[] | undefined, ref: string | undefined): number | null {
  if (!dms || dms.length < 3) return null;

  const degrees = dms[0];
  const minutes = dms[1];
  const seconds = dms[2];

  let decimal = degrees + (minutes/ 60) + (seconds / 3600);

  if (ref === 'S' || ref === 'W') {
    decimal = decimal * -1;
  }

  return decimal;
}

async function calcFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  })
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function processMediaItem(mediaId: string) {
  const item = await db.query.media.findFirst({
    where: eq(media.id, mediaId),
    with: { storageBackend: true }
  })
  
  if (!item || !ffmpegPath || !ffprobePath ) return;
  const { client, bucket } = getStorageClient(item?.storageBackend?.config);

  const isVideo = item.mimetype.startsWith("video/");
  const pipeDir = path.join(os.tmpdir(), `lumi-pipe-${item.id}`);
  await fs.mkdir(pipeDir, { recursive: true });
  const localInput = path.join(pipeDir, `original`);

  try {
    if (!(await fileExists(localInput))) {
      await client.fGetObject(bucket, item.objectKey, localInput);
    }

    const fileHash = await calcFileHash(localInput);

    const existingMedia = await db.query.media.findFirst({
        where: and(
          eq(media.hash, fileHash),
          ne(media.hash, "pending")
        )
    });

    if (existingMedia) {
      console.log(`duplicate found for ${item.filename}`)
      await db.update(media).set({
        hash: fileHash,
        objectKey: existingMedia.objectKey,
        thumbnails: existingMedia.thumbnails,
        width: existingMedia.width,
        height: existingMedia.height,
        duration: existingMedia.duration,
        dateTaken: existingMedia.dateTaken,
        cameraModel: existingMedia.cameraModel,
        gpsLat: existingMedia.gpsLat,
        gpsLng: existingMedia.gpsLng,
        storageBackendId: existingMedia.storageBackendId,
        hoverSpriteKey: existingMedia.hoverSpriteKey,
        hlsPlaylistKey: existingMedia.hlsPlaylistKey
      }).where(eq(media.id, item.id));

      const sizeInMB = item.size > 0 ? Math.max(1, Math.round(item.size / (1024 * 1024))) : 0;
      await db.update(users)
          .set({ storageUsed: sql`GREATEST(0, ${users.storageUsed} - ${sizeInMB})` })
          .where(eq(users.id, item.ownerId));
      await client.removeObject(bucket, item.objectKey);
      await redisCache.del(`user_photos_timeline:${item.ownerId}`);
      await fs.rm(pipeDir, { recursive: true, force: true });
      return;
    }

    let width = 0;
    let height = 0;
    let duration: number | null = null;
    let dateTaken: Date | null = null;
    let cameraModel: string | null = null;
    let gpsLat: number | null = null;
    let gpsLng: number | null = null;

    if (isVideo) {
      const stats = await fs.stat(localInput);
      if (stats.size === 0) {
        throw new Error(`0 bytes file, check minio connection`)
      }

      const { stdout: probeData } = await execa(ffprobePath, [
        "-v",
        "error",
        "-show_entries",
        "stream=width,height,codec_type,codec_name:format=duration",
        "-of",
        "json",
        localInput,
      ]);

      const metadata = JSON.parse(probeData);
      const videoStream = metadata?.streams?.find((s: any) => s.codec_type === 'video') || metadata?.streams?.find((s: any) => s.width && s.height);
      if (!videoStream) {
        console.log("STREAMS FOUND:", JSON.stringify(metadata.streams));
        throw new Error("no video stream found in file")
      }
      width = Number(videoStream.width) || 0;
      height = Number(videoStream.height) || 0;
      duration = metadata.format.duration ? parseFloat(metadata.format.duration) : 0;
    } else {
      const imageBuffer = await fs.readFile(localInput);
      try {
            const pipeline = sharp(imageBuffer);
            const metadata = await pipeline.metadata();
            width = metadata.width || 0;
            height = metadata.height || 0;

            if (metadata.exif) {
                try {
                    const exif = exifReader(metadata.exif) as any;
                    const photoData = exif.Photo || exif.exif;
                    if (photoData?.DateTimeOriginal instanceof Date) {
                    dateTaken = photoData.DateTimeOriginal;
                    }
                    if (photoData?.DateTimeOriginal && !(photoData.DateTimeOriginal instanceof Date)) {
                      dateTaken = new Date(photoData.DateTimeOriginal);
                    }

                    const imageData = exif.Image || exif.image;

                    if (imageData?.Model) {
                    cameraModel = String(imageData.Model);
                    }
                    const gpsData = exif.GPSInfo || exif.GPS || exif.gps;
                    if (gpsData) {
                      const lat = dmsToDecimal(gpsData.GPSLatitude, gpsData.GPSLatitudeRef);
                      const lng = dmsToDecimal(gpsData.GPSLongitude, gpsData.GPSLongitudeRef);

                      if (lat !== null && !isNaN(lat)) gpsLat = lat;
                      if (lng !== null && !isNaN(lng)) gpsLng = lng;
                    } 
                } catch (e) { console.warn("could not parse exif for", item.filename); }
              }
            } catch (e) {
              console.error(`invalid imdage data for ${item.filename}`);
              const sizeInMB = item.size > 0 ? Math.max(1, Math.round(item.size / (1024 * 1024))) :0;
              await db.update(users)
                .set({ storageUsed: sql`GREATEST(0, ${users.storageUsed} - ${sizeInMB})` })
                .where(eq(users.id, item.ownerId));
              await db.delete(media).where(eq(media.id, item.id));
              await client.removeObject(BUCKET_NAME, item.objectKey);
              await fs.rm(pipeDir, { recursive: true, force: true });
              return;
            }
          }

          await db
            .update(media)
            .set({
              width,
              height,
              duration,
              dateTaken: dateTaken || item.createdAt,
              cameraModel,
              gpsLat,
              gpsLng,
              hash: fileHash
            })
            .where(eq(media.id, item.id));

          await redisCache.del(`user_photos_timeline:${item.ownerId}`);
          await thumbnailQueue.add("generate-thumbs", { mediaId });
    } catch (err) {
      console.error(`error extracting metadata ${item.id}`, err)
      await fs.rm(pipeDir, { recursive: true, force: true });
      throw err;
    } 
  }
  export async function processThumbnails(mediaId: string) {
    const item = await db.query.media.findFirst({
      where: eq(media.id, mediaId),
      with: { storageBackend: true }
    })

    if (!item || !ffmpegPath || !ffprobePath) return;
    const { client, bucket } = getStorageClient(item?.storageBackend?.config)
    const isVideo = item.mimetype.startsWith("video/");
    const pipeDir = path.join(os.tmpdir(), `lumi-pipe-${item.id}`);
    await fs.mkdir(pipeDir, { recursive: true });
    const localInput = path.join(pipeDir, `original`);
    const tempHlsDir = path.join(pipeDir, `hls-gen`);

    try {
      if (!(await fileExists(localInput))) {
        await client.fGetObject(bucket, item.objectKey, localInput);
      }
      let thumbnailBuffer: Buffer;
      let hoverSpriteKey: string | null = null;
      let hlsPlaylistKey: string | null = null;

      if (isVideo) {
        const { stdout: frameBuffer } = await execa(
          ffmpegPath,
          [
            "-ss",
            "00:00:01",
            "-i",
            localInput,
            "-vframes",
            "1",
            "-an",
            '-threads', '2',
            "-f",
            "image2",
            "-c:v",
            "mjpeg",
            "pipe:1",
          ],
          { encoding: null },
        );
        thumbnailBuffer = frameBuffer as unknown as Buffer;

        try {
          const spriteOutput = path.join(os.tmpdir(), `sprite-${item.id}.webp`);
          await execa(ffmpegPath, [
            "-y", "-i", localInput,
            "-t", "3",
            "-vf", "fps=5,scale=320:-1:flags=lanczos",
            "-vcodec", "libwebp", "-lossless", "0", "-q:v", "60", "-loop", "0", "-an",
            spriteOutput
          ]);
          hoverSpriteKey = `sprites/${item.ownerId}/${item.id}.webp`;
          await client.fPutObject(bucket, hoverSpriteKey, spriteOutput, { "Content-Type": "image/webp" });
          await fs.unlink(spriteOutput);
        } catch (err) {
            console.error(`failed to genrate hover sprite ${item.filename}`, err);
        }

        const { stdout: probeData } = await execa(ffprobePath, [
          "-v",
          "error",
          "-show_entries",
          "stream=codec_name",
          "-of",
          "json",
          localInput,
        ]);
        const codec = JSON.parse(probeData)?.streams?.[0]?.codec_name || "";
        const isHevc = codec === "hevc" || codec === "h265" || codec === "prores";
        const isLarge = item.size > 50 * 1024 * 1024;
        const isLong = (item.duration ?? 0) > 60;

        if (isHevc || isLarge || isLong) {
          await fs.mkdir(tempHlsDir, { recursive: true });
          await execa(ffmpegPath, [
              "-y", "-i", localInput,
              "-c:v", "libx264", "-crf", "23", "-preset", "veryfast",
              "-vf", "scale=-2:720",
              "-c:a", "aac", "-b:a", "128k", "-ac", "2",
              "-f", "hls",
              "-hls_time", "10",
              "-hls_playlist_type", "vod",
              "-hls_segment_filename", path.join(tempHlsDir, "segment_%03d.ts"),
              path.join(tempHlsDir, "playlist.m3u8")
          ]);

          const files = await fs.readdir(tempHlsDir);
          for (const file of files) {
              const filePath = path.join(tempHlsDir, file);
              const minioPath = `hls/${item.ownerId}/${item.id}/${file}`;
              const contentType = file.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t";
              await client.fPutObject(bucket, minioPath, filePath, { "Content-Type": contentType });

              if (file.endsWith(".m3u8")) {
                  hlsPlaylistKey = minioPath;
              }
          }
        }
      } else {
        thumbnailBuffer = await fs.readFile(localInput);
      }

    const sizes = { small: 300, medium: 720, large: 1440 };
    const thumbnails: Record<string, string> = {};
    for (const [name, width] of Object.entries(sizes)) {
      const thumbBuffer = await sharp(thumbnailBuffer)
        .rotate()
        .resize(width, null, { withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      
      if (name === "small") {
          await fs.writeFile(path.join(pipeDir, "small.webp"), thumbBuffer)
      }

      const thumbKey = `thumbs/${item.ownerId}/${item.id}-${name}.webp`;
      await client.putObject(
        bucket,
        thumbKey,
        thumbBuffer,
        thumbBuffer.length,
        { "Content-Type": "image/webp" },
      );
      thumbnails[name] = thumbKey;
    }

    await db.update(media).set({
      thumbnails,
      hoverSpriteKey,
      hlsPlaylistKey
    }).where(eq(media.id, item.id));
    await redisCache.del(`media_meta:${item.id}`);
    
    await aiQueue.add("ai-index", {mediaId});
  } catch (err) { console.error(`thumbnail gen error for ${item.id}`, err);
    await fs.rm(pipeDir, { recursive: true, force: true });
    throw err;
  }
}

export async function processAiIndexing(mediaId: string) {
  const item = await db.query.media.findFirst({
      where: eq(media.id, mediaId),
      with: { storageBackend: true }
  });

  if (!item) return;
  const { client, bucket } = getStorageClient(item?.storageBackend?.config);
  const pipeDir = path.join(os.tmpdir(), `lumi-pipe-${item.id}`);
  const localInput = path.join(pipeDir, `small.webp`);

  try {
    let clipEmbedding: number[] | null = null;
    let blurScore: number | null = null;
    let aiTags: string[] = [];
    let detectedFaces: any[] = [];
    let extractedText: string | null = null;
    const isVideo = item.mimetype.startsWith("video/")

    let buffer: Buffer;

    if (await fileExists(localInput)) {
        buffer = await fs.readFile(localInput);
    } else {
        const thumbKey = (item.thumbnails as any)?.small || item.objectKey;
        const stream = await client.getObject(bucket, thumbKey);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        buffer = Buffer.concat(chunks);
      }

    try {
      const formData = new FormData();
      formData.append("file", new Blob([new Uint8Array(buffer)]), "image.jpg");

        const aiResp = await fetch(`${env.ML_API_URl}/analyze/image`, {
            method: "POST",
            body: formData as any,
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          clipEmbedding = aiData.clipEmbedding;
          blurScore = aiData.blurScore;
          aiTags = aiData.tags || [];
          detectedFaces = aiData.faces || [];
          extractedText = aiData.extractedText || null;
        } else {
            console.error("AI analysis failed", aiResp.status);
        }
    } catch (err) {
        console.error("Failed to reach ML", err);
    }

    await db
      .update(media)
      .set({
        clipEmbedding,
        blurScore,
        extractedText,
      })
      .where(eq(media.id, item.id));

      if (aiTags.length > 0) {
        for (const tagName of aiTags) {
          const existingsTags = await db.insert(tags)
              .values({ ownerId: item.ownerId, name: tagName })
              .onConflictDoNothing()
              .returning({ id: tags.id });
          
          let tagId = existingsTags[0]?.id;
          if (!tagId) {
              const t = await db.query.tags.findFirst({ where: and(eq(tags.name, tagName), eq(tags.ownerId, item.ownerId)) });
              if (t) tagId = t.id;
          }

          if (tagId) {
              await db.insert(mediaTags).values({ mediaId: item.id, tagId }).onConflictDoNothing();
          }
        }
      }

      if (detectedFaces.length >  0) {
        for (const face of detectedFaces) {
            const embeddingStr = `[${face.embedding.join(',')}]`;
            const result = await db.execute(sql`
                SELECT person_id, (face_embedding <=> ${embeddingStr}::vector) AS distance
                FROM ${faces}
                WHERE face_embedding is NOT NULL
                ORDER BY distance ASC
                LIMIT 1    
            `);

            let personId: string;
            const closestMatch = result[0] as { person_id: string, distance: number } | undefined;
            if (closestMatch && closestMatch.distance < 0.40) {
                personId = closestMatch.person_id;
            } else {
                const newPerson = await db.insert(people).values({
                    ownerId: item.ownerId,
                    name: "Unknown Person"
                }).returning({ id: people.id });
                personId = newPerson[0].id
            }

            const insertedFace = await db.insert(faces).values({
                mediaId: item.id,
                personId: personId,
                boundingBox: face.boundingBox,
                faceEmbedding: face.embedding
            }).returning({ id: faces.id });

            await db.execute(sql`
                UPDATE ${people} SET cover_face_id = ${insertedFace[0].id}
                WHERE id = ${personId} AND cover_face_id is NULL    
            `);
        }
      }

      console.log(`processed ${isVideo ? 'video' : 'image'}: ${item.filename}`);
      await redisCache.del(`user_photos_timeline:${item.ownerId}`);
      await redisCache.del(`user_albums_grid:${item.ownerId}`);
      if (item.gpsLat !== null && item.gpsLng !== null) {
        await redisCache.del(`user_locations:${item.ownerId}`);
      }
    } catch (err) {
      console.error(`AI processing erorr for ${item.id}`, err);
      throw err;
    } finally {
      try { await fs.rm(pipeDir, { recursive: true, force: true }); } catch (e) {}
    }
  }