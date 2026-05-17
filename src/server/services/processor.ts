import sharp from 'sharp';
import exifReader from 'exif-reader';
import { minioClient, BUCKET_NAME } from '@/lib/storage';
import { db } from '@/db';
import { media } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { exitCode } from 'process';

export async function processMediaItem(mediaId: string) {
    const item = await db.query.media.findFirst({ where: eq(media.id, mediaId) });
    if (!item) return;

    try {
        const stream = await minioClient.getObject(BUCKET_NAME, item.objectKey);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer =  Buffer.concat(chunks);

        const pipeline = sharp(buffer);
        const metadata = await pipeline.metadata();

        let dateTaken: Date | null = null;
        let cameraModel: string | null = null;
        let gpsLat: number | null = null;
        let gpsLng: number | null = null;

        if (metadata.exif) {
            try {
                const exif = exifReader(metadata.exif);
                if (exif.Photo?.DateTimeOriginal instanceof Date)
                    { dateTaken = exif.Photo.DateTimeOriginal; }
                if(exif.Image?.Model) 
                    { cameraModel = String(exif.Image.Model); }
                if(exif.GPSInfo?.Latitude !== undefined) 
                    { const lat = Number(exif.GPSInfo.Latitude); 
                      if (!isNaN(lat)) gpsLat = lat;
                    }
                if(exif.GPSInfo?.Longitude !== undefined) 
                    { const lng = Number(exif.GPSInfo.Longitude);
                      if (!isNaN(lng)) gpsLng = lng;
                }
            } catch (e) {
                console.warn("could not parse exif for", item.filename)
            }
        }

        const sizes  = { small: 300, medium: 720, large: 1440 };
        const thumbnails: Record<string, string> = {};

        for (const [name, width] of Object.entries(sizes)) {
            const thumbBuffer = await pipeline
            .clone()
            .resize(width, null, { withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();

            const thumbKey = `thumbs/${item.ownerId}/${item.id}-${name}.webp`;
            await minioClient.putObject(BUCKET_NAME, thumbKey, thumbBuffer, thumbBuffer.length, { 'Content-Type': 'image/webp' });
            thumbnails[name] = thumbKey;
        }

        await db.update(media).set({
            width: metadata.width,
            height: metadata.height,
            thumbnails: thumbnails,
            dateTaken: dateTaken || item.createdAt,
            cameraModel: cameraModel,
            gpsLat: gpsLat,
            gpsLng: gpsLng,
        }).where(eq(media.id, item.id));

        console.log(`Processed thumbnails for ${item.filename}`);
    } catch (err) {
        console.error(`processing error for ${item.filename}:`, err);
    }
}