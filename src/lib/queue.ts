import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { env } from './env';

const connection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
});


const defaultJobOptions = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
} as const;

export const metadataQueue = new Queue('metadata-extraction', {
    connection, defaultJobOptions
});
export const thumbnailQueue = new Queue('thumbnail-generation', {
    connection, defaultJobOptions
});
export const aiQueue = new Queue('ai-indexing', {
    connection, defaultJobOptions
});

export const takeoutQueue = new Queue('takeout-generation', { connection, defaultJobOptions });

export const systemQueue = new Queue('system-tasks', { connection, defaultJobOptions });

export const migrationQueue = new Queue('storage-migration', {
    connection,
    defaultJobOptions: { attempts: 1 }
});

export const faceClusterQueue = new Queue('face-clustering', {
    connection,
    defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000},
    }
});

export async function addMediaToPipe(mediaId: string) {
    await metadataQueue.add("extract", { mediaId });
}