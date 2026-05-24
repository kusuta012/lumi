import { Client } from 'minio';
import { env } from './env'

export const minioClient = new Client({
    endPoint: env.MINIO_ENDPOINT,
    port: env.MINIO_PORT,
    useSSL: env.MINIO_USE_SSL,
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY
});

export const BUCKET_NAME = env.MINIO_BUCKET

const clientPool = new Map<string, Client>();

export function getStorageClient(config: any | null | undefined, backendId?: string | null) {
    if (!config) {
        return { client: minioClient, bucket: BUCKET_NAME, isEnv: true };
    }

    if (backendId && clientPool.has(backendId)) {
        return { client: clientPool.get(backendId)!, bucket: config.bucket as string, isEnv: false }; 
    }

    const scrEndpoint = config.endpoint || config.endPoint;

    if (!scrEndpoint || !config.bucket ) {
        throw new Error(`storage config is corrupt or missing. endpoint ${scrEndpoint} , bucket ${config.bucket}`)
    }

    const client = new Client({
        endPoint: scrEndpoint,
        port: config.port ? parseInt(config.port) : undefined,
        useSSL: scrEndpoint?.includes('https') || false,
        accessKey: config.accessKey,
        secretKey: config.secretKey,
    });

    if (backendId) {
        clientPool.set(backendId, client);
    }

    return { client, bucket: config.bucket as string, isEnv: false };
}