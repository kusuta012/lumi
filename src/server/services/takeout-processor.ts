    import yazl, { ZipFile } from "yazl";
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
            const archive = new yazl.ZipFile();
            const streamBridge = new PassThrough();

            archive.outputStream.pipe(streamBridge);
            const zipFilename = `backups/${userId}/takeout-${Date.now()}.zip`;
            const uploadPromise = dest.client.putObject(dest.bucket, zipFilename, streamBridge as any);
            const failedItems: string[] = [];

            for (const item of userMedia) {
                const src = getStorageClient(item.storageBackend?.config);
                try {
                    const fileStream = await src.client.getObject(src.bucket, item.objectKey);
                    archive.addReadStream(fileStream as any, `photos/${item.filename}`);
                } catch (err) {
                    console.error(`takeout failed to fetch ${item.filename}`);
                    failedItems.push(`Failed to include ${item.filename} minio object not found`)
                }
            }
            if (failedItems.length > 0) {
                archive.addBuffer(Buffer.from("The following files could not be exported due to storage errors:\n\n" + failedItems.join("\n")), "errors.txt");
            }

            const metadataDump = JSON.stringify(userMedia, null, 2);
            archive.addBuffer(Buffer.from(metadataDump), "metadata.json");
            archive.end();
            await uploadPromise;
            const downloadUrl = `/api/takeout?file=${encodeURIComponent(zipFilename)}`;
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