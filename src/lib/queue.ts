import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from './env';

const connection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
});

export const mediaQueue = new Queue('media-processing', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
    }
});