import "dotenv/config";
import { Job, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { processMediaItem, processThumbnails, processAiIndexing } from '@/server/services/processor';
import { env } from '@/lib/env'
import { processMigrationJob } from "@/server/services/migration-processor";
import { cleanExpiredTrash } from "@/server/actions/media-mutations";
import path from "path";
import { processTakeout } from "@/server/services/takeout-processor";
import { systemQueue } from "@/lib/queue";
import { SystemBackupJob } from "@/server/services/system-backup";
import { aestheticBackfill } from "@/server/services/backfill";
import { faceClustering } from "@/server/services/face-cluster";
import { faceClusterQueue } from "@/lib/queue";
import { GTakeoutImport } from "@/server/services/takeout-importer";

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

const takeoutWorker = new Worker(
    'takeout-generation',
    async (job) => {
        await processTakeout(job.data.userId);
    }, { connection, concurrency: 1 });

const systemWorker = new Worker(
    'system-tasks',
    async (job) => {
        if (job.name === "database-backup") {
            await SystemBackupJob(job.data?.userId);
        }
        if (job.name === "aesthetic-backfill") {
            await aestheticBackfill(job);
        }
    }, { connection, concurrency: 1 });

const faceClusterWorker = new Worker(
    'face-clustering',
    async (job) => {
        await faceClustering(job);
    },
    { connection, concurrency: 1 }
);

const takeoutImportWorker = new Worker(
    'takeout-import',
    async (job) => { await GTakeoutImport(job); },
    { connection, concurrency: 1 }
);

function logging(worker: Worker, name: string) {
    worker.on('completed', (job) => console.log(`[${name} job ${job.id}] completed`));
    worker.on('failed', (job, err) => console.error([`${name} job ${job?.id} Failed:`, err]));
}

logging(metadataWorker, "Metadata");
logging(thumbnailWorker, "Thumbnail");
logging(aiWorker, "AI index");
logging(takeoutWorker, "Takeout");
logging(systemWorker, "System");
logging(faceClusterWorker, "Face Cluster");
logging(takeoutImportWorker, "Takeout Import" );

console.log('lumi workers are active')
const migrator = new Worker('storage-migration', async (job) => {
    await processMigrationJob(job.data.sourceId, job.data.targetId);
}, { connection });

console.log('lumi migration worker is active');

systemQueue.add("database-backup", { userId: "system_cron" }, {
    repeat: { pattern: "0 3 * * *" }
});
systemQueue.add("aesthetic-backfill", {}, {
    repeat: { pattern: "30 3 * * *" },
    jobId: "cutie-aesthetic-backfill"
}) 


cleanExpiredTrash();
setInterval(() => {
    cleanExpiredTrash();
}, 86400000);