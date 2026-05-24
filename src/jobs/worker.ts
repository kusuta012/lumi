import "dotenv/config";
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { processMediaItem } from '@/server/services/processor';
import { env } from '@/lib/env'
import { migrationQueue } from "@/lib/queue";
import { processMigrationJob } from "@/server/services/migration-processor";
import { cleanExpiredTrash } from "@/server/actions/media-mutations";

const connection = new IORedis(env.REDIS_URL!, {
    maxRetriesPerRequest: null, 
});

const worker = new Worker('media-processing', async (job) => {
    await processMediaItem(job.data.mediaId);
}, { connection });

worker.on('completed', (job) => {
    console.log(`[WORKer] job ${job.id} completed successfully`);
})

worker.on('failed', (job, err) => {
    console.error(`[WORKER] job ${job?.id} failed`, err)
})

console.log('lumi worker is active')

const migrator = new Worker('storage-migration', async (job) => {
    await processMigrationJob(job.data.sourceId, job.data.targetId);
}, { connection });

console.log("lumi migration worker is actibe");

cleanExpiredTrash();
setInterval(() => {
    cleanExpiredTrash();
}, 86400000);