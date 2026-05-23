import sharp from "sharp";
import "dotenv/config";
import { execa } from "execa";
import ffmpegPath from "ffmpeg-static";
import { path as ffprobePath } from "ffprobe-static";
import exifReader from "exif-reader";
import { BUCKET_NAME, getStorageClient } from "@/lib/storage";
import { db } from "@/db";
import { media, users } from "@/db/schema";
import { eq, sql, and, ne } from "drizzle-orm";
import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import os from "os";
import { redisCache } from "@/lib/cache";
import crypto from "crypto";

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

export async function processMediaItem(mediaId: string) {
  const item = await db.query.media.findFirst({
    where: eq(media.id, mediaId),
    with: { storageBackend: true }
  })
  
  if (!item || !ffmpegPath) return;
  const { client, bucket } = getStorageClient(item?.storageBackend?.config);

  

  const isVideo = item.mimetype.startsWith("video/");
  const tempInput = path.join(os.tmpdir(), `lumi-input-${item.id}`);

  try {
    await client.fGetObject(bucket, item.objectKey, tempInput);

    const fileHash = await calcFileHash(tempInput);
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
        storageBackendId: existingMedia.storageBackendId
      }).where(eq(media.id, item.id));

      const sizeInMB = item.size > 0 ? Math.max(1, Math.round(item.size / (1024 * 1024))) : 0;
      await db.update(users)
          .set({ storageUsed: sql`GREATEST(0, ${users.storageUsed} - ${sizeInMB})` })
          .where(eq(users.id, item.ownerId));
      await client.removeObject(bucket, item.objectKey);
      return;
    }

    let width = 0;
    let height = 0;
    let duration: number | null = null;
    let dateTaken: Date | null = null;
    let cameraModel: string | null = null;
    let gpsLat: number | null = null;
    let gpsLng: number | null = null;
    let thumbnailBuffer: Buffer;

    if (isVideo) {
      const stats = await fs.stat(tempInput);
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
        tempInput,
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

      const { stdout: frameBuffer } = await execa(
        ffmpegPath,
        [
          "-ss",
          "00:00:01",
          "-i",
          tempInput,
          "-vframes",
          "1",
          "-an",
          "-f",
          "image2",
          "-c:v",
          "mjpeg",
          "pipe:1",
        ],
        { encoding: null },
      );

      thumbnailBuffer = frameBuffer as unknown as Buffer;
    } else {
      const imageBuffer = await fs.readFile(tempInput);
      try {
            const pipeline = sharp(imageBuffer);
            const metadata = await pipeline.metadata();
            width = metadata.width || 0;
            height = metadata.height || 0;
            thumbnailBuffer = imageBuffer

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

                    if (imageData.Image?.Model) {
                    cameraModel = String(exif.Image.Model);
                    }
                    const gpsData = exif.GPSInfo || exif.GPS || exif.gps;
                    if (gpsData) {
                      const lat = dmsToDecimal(gpsData.GPSLatitude, gpsData.GPSLatitudeRef);
                      const lng = dmsToDecimal(gpsData.GPSLongitude, gpsData.GPSLongitudeRef);

                      if (lat !== null && !isNaN(lat)) gpsLat = lat;
                      if (lng !== null && !isNaN(lng)) gpsLng = lng;

                      console.log(`gps ${item.filename}`);
                      console.log(`raw lat`, gpsData.GPSLatitude, `Ref`, gpsData.GPSLatitudeRef);
                      console.log(`raw lng`, gpsData.GPSLongitude, `Ref`, gpsData.GPSLongitudeRef);
                      console.log(`parsed: ${lat}, BOOLL ${lng}`);
                    } else {
                      console.log(`no gps metada ${item.filename}`)
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
              return;
            }
          }

    const sizes = { small: 300, medium: 720, large: 1440 };
    const thumbnails: Record<string, string> = {};

    for (const [name, width] of Object.entries(sizes)) {
      const thumbBuffer = await sharp(thumbnailBuffer)
        .resize(width, null, { withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

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

    await db
      .update(media)
      .set({
        width,
        height,
        duration,
        thumbnails,
        dateTaken: dateTaken || item.createdAt,
        cameraModel,
        gpsLat,
        gpsLng,
        hash: fileHash
      })
      .where(eq(media.id, item.id));

      console.log(`processed ${isVideo ? 'video' : 'image'}: ${item.filename}`);

      if (gpsLat !== null && gpsLng !== null) {
        await redisCache.del(`user_locations:${item.ownerId}`);
      }

  } catch (err) {
    console.error(`error processing for ${item.id}`, err)
  } finally {
        try { await fs.unlink(tempInput); } catch (e) {}
  }
}