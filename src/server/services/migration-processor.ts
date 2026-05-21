import { db } from "@/db";
import { media, storageBackends, platformConfig } from "@/db/schema";
import { eq, isNull } from "drizzle-orm";
import { getStorageClient } from "@/lib/storage";
import { env } from "@/lib/env"
import path from "path";
import os from "os";
import fs from "fs/promises";

export async function processMigrationJob(sourceId: string, targetId: string) {
    try {
        console.log(`starting migragrion from ${sourceId} to ${targetId}`);
        const sourceConfig = sourceId === 'env' ? null : await db.query.storageBackends.findFirst({
            where: eq(storageBackends.id, sourceId)
        });
        const targetConfig = targetId === 'env' ? null : await db.query.storageBackends.findFirst({ where: eq(storageBackends.id, targetId) });
        const sConf = sourceConfig?.config as any;
        const tConf = targetConfig?.config as any;
        const sourceDrive = getStorageClient(sConf);
        const targetDrive = getStorageClient(tConf);

        const sourceSig = sConf ? (sConf.endpoint || sConf.endPoint || 'unknown-src') : env.MINIO_ENDPOINT
        const targetSig = tConf ? (tConf.endpoint || tConf.endPoint || 'unknown-tgt') : env.MINIO_ENDPOINT

        if (sourceSig === targetSig && sourceDrive.bucket === targetDrive.bucket ) {
            throw new Error(`source and target resolve to same physical bucket (${sourceSig}/${sourceDrive.bucket})`)
        }

        if (!(await targetDrive.client.bucketExists(targetDrive.bucket))) {
            await targetDrive.client.makeBucket(targetDrive.bucket);
        }
        const itemsToMigrate = await db.query.media.findMany({
            where: sourceId === 'env' ? isNull(media.storageBackendId) : eq(media.storageBackendId, sourceId)
        });

        let successCount = 0;
        for (const item of itemsToMigrate) {

            const tempOriginal = path.join(os.tmpdir(), `mig-orig-${item.id}`);
            try {
                const sStat = await sourceDrive.client.statObject(sourceDrive.bucket, item.objectKey);
                await sourceDrive.client.fGetObject(sourceDrive.bucket, item.objectKey, tempOriginal);
                await targetDrive.client.fPutObject(targetDrive.bucket, item.objectKey, tempOriginal, {});
                const tStat = await targetDrive.client.statObject(targetDrive.bucket, item.objectKey);
 
                if (tStat.size === 0 || tStat.size !== sStat.size) {
                    throw new Error(`size mismatch for ${item.objectKey}. source ${sStat.size}, target: ${tStat.size}`);
                }

                if (item.thumbnails) {
                    const thumbs = item.thumbnails as Record<string, string>;
                    for (const thumbPath of Object.values(thumbs)) {
                        const tempThumb = path.join(os.tmpdir(), `mig-thumb-${item.id}-${Date.now()}`);
                        try {
                            const thumbStat = await sourceDrive.client.statObject(sourceDrive.bucket, thumbPath);
                            await sourceDrive.client.fGetObject(sourceDrive.bucket, thumbPath, tempThumb);
                            await targetDrive.client.fPutObject(targetDrive.bucket, thumbPath, tempThumb, {});
                            const thumbTargetStat = await targetDrive.client.statObject(targetDrive.bucket, thumbPath);
                            if (thumbTargetStat.size !== thumbStat.size) throw new Error("thumbnail size mismatch");
                        } catch (e) {
                            console.warn(`failed to migrate thumbnail ${thumbPath}`);
                        } finally {
                            try { await fs.unlink(tempThumb); } catch (e) {}
                        }
                    }
                }
                await db.update(media).set({ storageBackendId: targetId === 'env' ? null : targetId }).where(eq(media.id, item.id));
                await sourceDrive.client.removeObject(sourceDrive.bucket, item.objectKey);
                if (item.thumbnails) {
                    for (const thumbPath of Object.values(item.thumbnails as Record<string, string>)) {
                        await sourceDrive.client.removeObject(sourceDrive.bucket, thumbPath);
                    }
                }
                successCount++;
                console.log(`migrated ${item.filename}`);
            } catch (err) {
                console.error(`failed to move item ${item.id}`, err);
            } finally {
                try { await fs.unlink(tempOriginal); } catch (e) {}
            }
        }
        console.log(`migration finished ${successCount}/${itemsToMigrate.length} items`);
        await db.update(platformConfig).set({ value: false }).where(eq(platformConfig.key, 'maintenance_mode'));
    } catch (err) {
        console.error("migration failure", err);
    }
}