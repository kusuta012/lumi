import "dotenv/config";
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { processMediaItem, processThumbnails, processAiIndexing } from '@/server/services/processor';
import { env } from '@/lib/env'
import { processMigrationJob } from "@/server/services/migration-processor";
import { cleanExpiredTrash } from "@/server/actions/media-mutations";
import path from "path"

const connection = new IORedis(env.REDIS_URL!, {
    maxRetriesPerRequest: null, 
});

const metadataWorker = new Worker(
    'metadata-extraction',
    async (job) => {
        await processMediaItem(job.data.mediaId);
    }, { connection, concurrency: 8 });

const thumbnailWorker = new Worker(
    'thumbnail-generation',
    async (job) => {
        await processThumbnails(job.data.mediaId);
    }, { connection, concurrency: 4 });

const aiWorker = new Worker(
    'ai-indexing',
    async (job) => {
        await processAiIndexing(job.data.mediaId);
    }, { connection, concurrency: 2 });

function logging(worker: Worker, name: string) {
    worker.on('completed', (job) => console.log(`[${name} job ${job.id}] completed`));
    worker.on('failed', (job, err) => console.error([`${name} job ${job?.id} Failed:`, err]));
}

logging(metadataWorker, "Metadata");
logging(thumbnailWorker, "Thumbnail");
logging(aiWorker, "AI index");

console.log('lumi workers are active')
const migrator = new Worker('storage-migration', async (job) => {
    await processMigrationJob(job.data.sourceId, job.data.targetId);
}, { connection });

console.log('lumi migration worker is active');

cleanExpiredTrash();
setInterval(() => {
    cleanExpiredTrash();
}, 86400000);