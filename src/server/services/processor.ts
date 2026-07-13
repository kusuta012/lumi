import sharp from "sharp";
import "dotenv/config";
import { execa } from "execa";
import ffmpegPath from "ffmpeg-static";
import { path as ffprobePath } from "ffprobe-static";
import exifReader from "exif-reader";
import { BUCKET_NAME, getStorageClient } from "@/lib/storage";
import { db } from "@/db";
import { faces, media, mediaTags, tags, users, people, platformConfig } from "@/db/schema";
import { eq, sql, and, ne, inArray } from "drizzle-orm";
import fs from "fs/promises";
import { createReadStream, createWriteStream} from "fs";
import path from "path";
import os from "os";
import { redisCache, cacheInvalid, cacheRedis } from "@/lib/cache";
import crypto from "crypto";
import { env } from "@/lib/env"
import { thumbnailQueue, aiQueue } from "@/lib/queue";
import { geoChief } from "./geo-chief";
import { broadcastAlbumUpdate } from "@/lib/pubsub";
import { albumMedia } from "@/db/schema";

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
    let fileHash = "";

    if (!(await fileExists(localInput))) {
      const objStream = await client.getObject(bucket, item.objectKey);
      const hash = crypto.createHash('sha256');
      const writeStream  = createWriteStream(localInput);
      
      await new Promise((resolve, reject) => {
        objStream.on('data', (chunk: Buffer) => {
            hash.update(chunk);
            writeStream.write(chunk);
        });
        objStream.on('end', () => writeStream.end());
        writeStream.on('finish', () => resolve(null));
        writeStream.on('error', reject);
        objStream.on('error', reject);
      });
      fileHash = hash.digest('hex');
    } else {
      fileHash = await calcFileHash(localInput);
    }

    const existingMedia = await db.query.media.findFirst({
        where: and(
          eq(media.ownerId, item.ownerId),
          eq(media.hash, fileHash),
          ne(media.hash, "pending"),
          ne(media.id, item.id),
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
      await cacheInvalid.onMediaChanged(item.ownerId, item.id, existingMedia.gpsLat !== null);
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
    let locationCity: string | null = null;
    let locationState: string | null = null;
    let locationCountry: string | null = null;
    let lensModel: string | null = null;
    let focalLength: number | null = null;
    let fNumber: number | null = null;
    let iso: number | null = null;
    let exposureTime: number | null = null;
    let fps: number | null = null;

    if (isVideo) {
      const stats = await fs.stat(localInput);
      if (stats.size === 0) {
        throw new Error(`0 bytes file, check minio connection`)
      }

      const { stdout: probeData } = await execa(ffprobePath, [
        "-v",
        "error",
        "-show_entries",
        "stream=width,height,codec_type,codec_name,r_frame_rate:format=duration",
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

      if (videoStream.r_frame_rate) {
        const [num, den] = videoStream.r_frame_rate.split('/');
        if (num && den && Number(den) !== 0) {
          fps = Number(num) / Number(den);
        }
      }

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
                    if (photoData?.lensModel) lensModel = String(photoData.LensModel);
                    if (photoData?.FocalLength) focalLength = Number(photoData.FocalLength);
                    if (photoData?.FNumber) fNumber = Number(photoData.fNumber);
                    if (photoData?.ISOSpeedRatings) iso = Number(photoData.ISOSpeedRatings);
                    if (photoData?.ExposureTime) exposureTime = Number(photoData.ExposureTime); 
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

          if (gpsLat !== null && gpsLng !== null) {
            try {
              const location = await geoChief.resolve(gpsLat, gpsLng);
              if (location) {
                locationCity = location.name;
                locationState = location.adminName;
                locationCountry = location.countryCode;
              }
            } catch (err) {
                console.error(`failed to reverse geocode ${item.filename}`, err);
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
              lensModel,
              focalLength,
              fNumber,
              iso,
              exposureTime,
              fps,
              gpsLat,
              gpsLng,
              hash: fileHash,
              locationCity,
              locationCountry,
              locationState
            })
            .where(eq(media.id, item.id));

          await cacheInvalid.onMediaChanged(item.ownerId, mediaId, gpsLat !== null && gpsLng !== null);
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

      const transcodeConfigRaw = await db.query.platformConfig.findFirst({
        where: eq(platformConfig.key, 'video_transcoding')
      });
      const transcodeRules = transcodeConfigRaw?.value as any || {
        enableHevc: true, enableLarge: true, largeThresholdMB: 50, enableLong: true, longThresholdSec: 60
      };

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
        const isHevc = transcodeRules.enableHevc && (codec === "hevc" || codec === "h265" || codec === "prores");
        const isLarge = transcodeRules.enableLarge && (item.size > 50 * 1024 * 1024);
        const isLong = transcodeRules.enableLong && ((item.duration ?? 0) > transcodeRules.longThresholdSec);

        if (isHevc || isLarge || isLong) {
          await fs.mkdir(tempHlsDir, { recursive: true });
          await execa(ffmpegPath, [
              "-y", "-hwaccel", "auto",
              "-i", localInput,
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
    await cacheInvalid.onMediaChanged(item.ownerId, item.id, item.gpsLat !== null);
    
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
    let aestheticScore: number | null = null;
    const { getAiSettings } = await import("@/server/actions/config-actions");
    const aiSettings: any = await getAiSettings();
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
            headers: {
              "x-enable-clip": String(aiSettings.clip_enabled ?? true),
              "x-enable-faces": String(aiSettings.face_detection_enabled ?? true),
              "x-enable-ocr": String(aiSettings.ocr_enabled ?? true),
              "x-enable-nima": String(aiSettings.aesthetic_scoring_enabled ?? true),
              "x-enable-tags": String(aiSettings.auto_tagging_enabled ?? true),
              "x-face-confidence": String(aiSettings.face_confidence_threshold ?? 0.85),
            }
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          clipEmbedding = aiData.clipEmbedding;
          blurScore = aiData.blurScore;
          aiTags = aiData.tags || [];
          detectedFaces = aiData.faces || [];
          extractedText = aiData.extractedText || null;
          aestheticScore = aiData.aestheticScore ?? null;
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
        aestheticScore,
      })
      .where(eq(media.id, item.id));

      if (aiTags.length > 0) {
          const tagValues = aiTags.map(name => ({ ownerId: item.ownerId, name }));
          await db.insert(tags).values(tagValues).onConflictDoNothing();

          const existingsTags = await db.query.tags.findMany({
              where: and(
                eq(tags.ownerId, item.ownerId),
                inArray(tags.name, aiTags)
              )
          });
          
          if (existingsTags.length > 0) {
            const mediaTagValues = existingsTags.map(t => ({
                mediaId: item.id,
                tagId: t.id,
            }));
            await db.insert(mediaTags).values(mediaTagValues).onConflictDoNothing();
        }
      }

      if (detectedFaces.length >  0) {
        for (const face of detectedFaces) {
            const embeddingStr = `[${face.embedding.join(',')}]`;
            const result = await db.execute(sql`
                SELECT person_id, (face_embedding <=> ${embeddingStr}::vector) AS distance
                FROM ${faces} f
                INNER JOIN ${people} p ON f.person_id = p.id
                WHERE face_embedding is NOT NULL
                  AND p.owner_id = ${item.ownerId}::uuid
                ORDER BY distance ASC
                LIMIT 1    
            `);

            let personId: string;
            const closestMatch = result[0] as { person_id: string, distance: number } | undefined;
            if (closestMatch && closestMatch.distance < (aiSettings.face_distance_threshold ?? 0.40)) {
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
      const linkedAlbums = await db.select({ albumId: albumMedia.albumId })
          .from(albumMedia)
          .where(eq(albumMedia.mediaId, item.id));
      
      for (const link of linkedAlbums) {
                const lockKey = `throttle:album_broadcast:${link.albumId}`;
                const shouldBroadcast = await cacheRedis.set(lockKey, "1", "EX", 3, "NX");
                if (shouldBroadcast) {
                  await broadcastAlbumUpdate(link.albumId);
                }
            }

      console.log(`processed ${isVideo ? 'video' : 'image'}: ${item.filename}`);
      await cacheInvalid.onMediaChanged(item.ownerId, item.id, item.gpsLat !== null && item.gpsLng !== null);
      await cacheInvalid.onAlbumChanged(item.ownerId);
      await cacheInvalid.onAimetaChanged(item.ownerId);
    } catch (err) {
      console.error(`AI processing erorr for ${item.id}`, err);
      throw err;
    } finally {
      try { await fs.rm(pipeDir, { recursive: true, force: true }); } catch (e) {}
    }
  }