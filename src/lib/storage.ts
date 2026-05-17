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