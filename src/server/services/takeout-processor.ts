import archiver from "archiver";
import { PassThrough } from "stream";
import { db } from "@/db";
import { media, storageBackends, auditLogs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getStorageClient } from "@/lib/storage";

export async function processTakeout(userId: string) {
    try {
        const userMedia = await db.query.media.findMany({
            where: and(eq(media.ownerId, userId), eq(media.isDeleted, false)),
            with: { storageBackend: true }
        });

        if (userMedia.length === 0) {
            return;
        }

        const defaultBackend = await db.query.storageBackends.findFirst({ where: eq(storageBackends.isDefault, true) });
        const dest = getStorageClient(defaultBackend?.config);
        const archive = archiver('zip', { zlib: { level: 5 } });
        const streamBridge = new PassThrough();

        archive.pipe(streamBridge);
        const zipFilename = `backups/${userId}/takeout-${Date.now()}.zip`;
        const uploadPromise = dest.client.putObject(dest.bucket, zipFilename, streamBridge as any);

        for (const item of userMedia) {
            const src = getStorageClient(item.storageBackend?.config);
            try {
                const fileStream = await src.client.getObject(src.bucket, item.objectKey);
                archive.append(fileStream as any, { name: `photos/${item.filename}` });
            } catch (err) {
                console.error(`takeout failed to fetch ${item.filename}`);
            }
        }

        const metadataDump = JSON.stringify(userMedia, null, 2);
        archive.append(metadataDump, { name: "metadata.json" });
        await archive.finalize();
        await uploadPromise;
        const downloadUrl = await dest.client.presignedGetObject(dest.bucket, zipFilename, 7 * 24 * 60 * 60);
        await db.insert(auditLogs).values({
            actorId: userId,
            action: "takeout_generated",
            details: {
                file: zipFilename,
                url: downloadUrl,
                expiresIn: "7 days",
                itemCount: userMedia.length
            }
        });
    } catch (err) {
        throw err;
    }
}