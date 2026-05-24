"use server";

import { media } from "@/db/schema";
import { mediaQueue, migrationQueue } from "@/lib/queue";
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
        const [mediaCounts, migrationCounts, isMediaPaused, isMigrationPaused] = await Promise.all([
            mediaQueue.getJobCounts(),
            migrationQueue.getJobCounts(),
            mediaQueue.isPaused(),
            migrationQueue.isPaused()
        ]);

        return {
            success: true,
            queues: [
                {
                    name: "media-processing",
                    displayName: "Media Processor",
                    counts: mediaCounts,
                    isPaused: isMediaPaused
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
    const queue = queueName === "media-processing" ? mediaQueue : migrationQueue;

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