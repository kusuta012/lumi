import { Client } from 'minio';
import { env } from './env'
import { fallbackModeToFallbackField } from 'next/dist/lib/fallback';

export const minioClient = new Client({
    endPoint: env.MINIO_ENDPOINT,
    port: env.MINIO_PORT,
    useSSL: env.MINIO_USE_SSL,
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY
});

export const BUCKET_NAME = env.MINIO_BUCKET

export function getStorageClient(config: any) {
    if (!config) {
        return { client: minioClient, bucket: BUCKET_NAME, isEnv: true };
    }

    const scrEndpoint = config.endpoint || config.endPoint;

    if (!scrEndpoint || !config.bucket ) {
        throw new Error(`storage config is corrupt or missing. endpoint ${scrEndpoint} , bucket ${config.bucket}`)
    }

    const client = new Client({
        endPoint: scrEndpoint,
        port: config.port ? parseInt(config.port) : undefined,
        useSSL: String(scrEndpoint).includes('https'),
        accessKey: config.accessKey,
        secretKey: config.secretKey,
    });

    return { client, bucket: config.bucket as string, isEnv: false };
}