import { execa } from "execa";
import { db } from "@/db";
import { storageBackends, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getStorageClient } from "@/lib/storage";
import { env } from "@/lib/env";
import path from "path";
import os from "os";
import fs from "fs/promises";

export async function SystemBackupJob(triggeredBy: string = "system_cron") {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dumpFile = path.join(os.tmpdir(), `lumi-db-snapshot-${timestamp}.dump`);

    try {
        await execa("pg_dump", [
            "-Fc",
            "-Z", "5",
            "-d", env.DATABASE_URL,
            "-f", dumpFile
        ]);
        const defaultBackend = await db.query.storageBackends.findFirst({
            where: eq(storageBackends.isDefault, true)
        });
        const dest = getStorageClient(defaultBackend?.config);
        const objectKey = `server-backups/lumi-snapshot-${timestamp}.dump`;
        await dest.client.fPutObject(dest.bucket, objectKey, dumpFile, {
            "Content-Type": "application/octet-stream"
        });
        await db.insert(auditLogs).values({
            actorId: triggeredBy !== "system_cron" ? triggeredBy : null,
            action: "system_backup_completed",
            details: {
                file: objectKey,
                bucket: dest.bucket,
                size: (await fs.stat(dumpFile)).size,
                type: "Mannual"
            }
        });
    } catch (err) {
        console.error(`error generating snapshot`, err);
        throw err;
    } finally {
        try { await fs.unlink(dumpFile); } catch (e) {}
    }
}