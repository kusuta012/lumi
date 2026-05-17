import "dotenv/config";
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { processMediaItem } from '@/server/services/processor';
import { env } from '@/lib/env'

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