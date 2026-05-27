"use server";

import { metadataQueue, thumbnailQueue, aiQueue, migrationQueue } from "@/lib/queue";
import { auth } from "@/server/auth";
import { revalidatePath } from "next/cache";

async function ensureSuperAdmin() {
    const session = await auth();
    if (session?.user?.roleName !== "Super Admin") {
        throw new Error("Unauthorized");
    }
}

export async function getQueueStats() {
    await ensureSuperAdmin();
    try {
        const [metadataCounts, thumbnailCounts, aiCounts, migrationCounts, isMetadataPaused, isThumbnailPaused, isAiPaused, isMigrationPaused] = await Promise.all([
            metadataQueue.getJobCounts(),
            thumbnailQueue.getJobCounts(),
            aiQueue.getJobCounts(),
            migrationQueue.getJobCounts(),
            metadataQueue.isPaused(),
            thumbnailQueue.isPaused(),
            aiQueue.isPaused(),
            migrationQueue.isPaused()
        ]);

        return {
            success: true,
            queues: [
                {
                    name: "metadata-extraction",
                    displayName: "Metadata Extractor",
                    counts: metadataCounts,
                    isPaused: isMetadataPaused
                },
                {
                    name: "thumbnail-generation",
                    displayName: "Thumbnail Generator",
                    counts: thumbnailCounts,
                    isPaused: isThumbnailPaused
                },
                {
                    name: "ai-indexing",
                    displayName: "AI Indexer",
                    counts: aiCounts,
                    isPaused: isAiPaused
                },
                {
                    name: "storage-migration",
                    displayName: "Storage Migrator",
                    counts: migrationCounts,
                    isPaused: isMigrationPaused
                }
            ]
        };
    } catch (err) {
        console.error("failed to fetch queue stats", err);
        return { success: false, error: "failed to connect to redis queue" };
    }
}

export async function manageQueue(queueName: string, action: 'retry' | 'clean' | 'toggle-pause') {
    await ensureSuperAdmin();

    let queue;
    if (queueName === "metadata-extraction") {
        queue = metadataQueue;
    } else if (queueName === "thumbnail-generation") {
        queue = thumbnailQueue;
    } else if (queueName === "ai-indexing") {
        queue = aiQueue;
    } else if (queueName === "storage-migration") {
        queue = migrationQueue;
    } else {
        return { success: false, error: "Invalid queue name" };
    }

    try {
        if (action === 'retry') {
            const failedJobs = await queue.getFailed();
            await Promise.all(failedJobs.map(job => job.retry()));
        } else if (action === 'clean') {
            await queue.clean(0, 0, 'completed');
            await queue.clean(0, 0, 'failed');
        } else if (action === 'toggle-pause') {
            const isPaused = await queue.isPaused();
            if (isPaused) await queue.resume();
            else await queue.pause();
        }

        revalidatePath("/admin/workers");
        return { success: true };
    } catch (err) {
        console.error(`queue action ${action} failed`, err);
        return { success: false, error: "Action failed" };
    }
}