import { db } from "@/db";
import { media } from "@/db/schema";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { env } from "@/lib/env";
import { getStorageClient } from "@/lib/storage";
import { cacheInvalid } from "@/lib/cache";
import type { Job } from "bullmq";

const BATCH_SIZE = 50;
const THRO_MS = 200;
const MAX_ITMES = 5000;

export async function aestheticBackfill(job: Job) {
    const pendingItems = await db.query.media.findMany({
        where: and(
            isNull(media.aestheticScore),
            isNotNull(media.thumbnails),
            eq(media.isDeleted, false)
        ),
        columns: {
            id: true,
            ownerId: true,
            thumbnails: true,
            storageBackendId: true,
        },
        with: { storageBackend: true },
        limit: MAX_ITMES,
    });

    if (pendingItems.length === 0) {
        console.log("backfill done, all media scored");
        return { scored: 0, failed: 0, skipped: 0, reason: "complete" };
    }

    let scored = 0;
    let failed = 0;
    let skipped = 0;
    const affectedOwners = new Set<string>();

    for (let i = 0; i < pendingItems.length; i++) {
        const item = pendingItems[i];

        try {
            const thumbKey = (item.thumbnails as any)?.small;
            if (!thumbKey) {
                skipped++;
                continue;
            }
            const { client, bucket } = getStorageClient((item as any).storageBackend?.config);
            const stream = await client.getObject(bucket, thumbKey);
            const chunks: Buffer[] = [];
            for await (const chunk of stream) {
                chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
            }
            const buffer = Buffer.concat(chunks);
            const formData = new FormData();
            formData.append("file", new Blob([new Uint8Array(buffer)]), "thump.webp");
            const resp = await fetch(`${env.ML_API_URl}/score/aesthetic`, {
                method: "POST",
                body: formData as any,
            });

            if (resp.ok) {
                const data = await resp.json();
                if (data.aestheticScore != null) {
                    await db.update(media)
                        .set({ aestheticScore: data.aestheticScore })
                        .where(eq(media.id, item.id));
                    scored++;
                    affectedOwners.add(item.ownerId);
                } else {
                    skipped++;
                }
            } else {
                const errText = await resp.text().catch(() => "unknown");
                console.error(`ml returned ${resp.status} for ${item.id} : ${errText}`);
                failed++;

                if (resp.status === 503) {
                    console.error("ml report NIMA 503");
                    break;
                }
            }
        } catch (err) {
            console.error(`error scoring ${item.id}:`, err);
            failed++;
            if (failed > 10 && failed > scored) {
                console.error("too many failures ahh");
                break;
            }
        }

        await new Promise(r => setTimeout(r, THRO_MS));
        if ((i + 1) % 50 === 0) {
            const pct = Math.round(((i + 1) / pendingItems.length) * 100);
            await job.updateProgress(pct);
            console.log(`progress: ${i + 1}/${pendingItems.length} (${pct}%)`); 
        }
    }

    for (const ownerId of affectedOwners) {
        await cacheInvalid.onAimetaChanged(ownerId);
    }
    const result = { scored, failed, skipped, total: pendingItems.length };
    console.log(`complete`, result);
    return result;
}