import sharp from "sharp";
import "dotenv/config";
import { execa } from "execa";
import ffmpegPath from "ffmpeg-static";
import { path as ffprobePath } from "ffprobe-static";
import exifReader from "exif-reader";
import { getStorageClient } from "@/lib/storage";
import { db } from "@/db";
import { media } from "@/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import os from "os";

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
      const pipeline = sharp(imageBuffer);
      const metadata = await pipeline.metadata();
      width = metadata.width || 0;
      height = metadata.height || 0;
      thumbnailBuffer = imageBuffer

      if (metadata.exif) {
        try {
          const exif = exifReader(metadata.exif);
          if (exif.Photo?.DateTimeOriginal instanceof Date) {
            dateTaken = exif.Photo.DateTimeOriginal;
          }
          if (exif.Image?.Model) {
            cameraModel = String(exif.Image.Model);
          }
          if (exif.GPSInfo?.Latitude !== undefined) {
            const lat = Number(exif.GPSInfo.Latitude);
            if (!isNaN(lat)) gpsLat = lat;
          }
          if (exif.GPSInfo?.Longitude !== undefined) {
            const lng = Number(exif.GPSInfo.Longitude);
            if (!isNaN(lng)) gpsLng = lng;
          }
        } catch (e) {
          console.warn("could not parse exif for", item.filename);
        }
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
      })
      .where(eq(media.id, item.id));

      console.log(`processed ${isVideo ? 'video' : 'image'}: ${item.filename}`);

  } catch (err) {
    console.error(`error processing for ${item.id}`, err)
  } finally {
        try { await fs.unlink(tempInput); } catch (e) {}
  }
}