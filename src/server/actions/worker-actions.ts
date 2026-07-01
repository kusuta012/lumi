"use server";

import { metadataQueue, thumbnailQueue, aiQueue, migrationQueue, faceClusterQueue } from "@/lib/queue";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/permissions.server";

export async function getQueueStats() {
    await requirePermission("can_manage_server")
    try {
        const [metadataCounts, thumbnailCounts, aiCounts, migrationCounts, faceClusterCounts, isMetadataPaused, isThumbnailPaused, isAiPaused, isMigrationPaused, isFaceClusterPaused] = await Promise.all([
            metadataQueue.getJobCounts(),
            thumbnailQueue.getJobCounts(),
            aiQueue.getJobCounts(),
            migrationQueue.getJobCounts(),
            metadataQueue.isPaused(),
            thumbnailQueue.isPaused(),
            aiQueue.isPaused(),
            migrationQueue.isPaused(),
            faceClusterQueue.getJobCounts(),
            faceClusterQueue.isPaused(),
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
                },
                {
                    name: "face-clustering",
                    displayName: "Face Cluster",
                    counts: faceClusterCounts,
                    isPaused: isFaceClusterPaused
                }
            ]
        };
    } catch (err) {
        console.error("failed to fetch queue stats", err);
        return { success: false, error: "failed to connect to redis queue" };
    }
}

export async function manageQueue(queueName: string, action: 'retry' | 'clean' | 'toggle-pause') {
    await requirePermission("can_manage_server")

    let queue;
    if (queueName === "metadata-extraction") {
        queue = metadataQueue;
    } else if (queueName === "thumbnail-generation") {
        queue = thumbnailQueue;
    } else if (queueName === "ai-indexing") {
        queue = aiQueue;
    } else if (queueName === "storage-migration") {
        queue = migrationQueue;
    } else if (queueName === "face-clustering") {
        queue = faceClusterQueue;
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