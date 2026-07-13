import { Client } from 'minio';
import { env } from './env'
import fs from "fs/promises";
import { createReadStream } from 'fs';
import path from 'path';

export const minioClient = new Client({
    endPoint: env.MINIO_ENDPOINT,
    port: env.MINIO_PORT,
    useSSL: env.MINIO_USE_SSL,
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY
});

export const BUCKET_NAME = env.MINIO_BUCKET

const clientPool = new Map<string, any>();

export class DiskClient {
    basePath: string;

    constructor(config: { basePath?: string }) {
        this.basePath = config.basePath || path.join(process.cwd(), 'storage');
    }

    public getFullPath(bucket: string, key: string) {
        const safeKey = key.replace(/\.\.\//g, '');
        return path.join(this.basePath, bucket, safeKey);
    }

    async bucketExists(bucket: string) {
        try {
            await fs.access(path.join(this.basePath, bucket));
            return true;
        } catch {
            return false;
        }
    }

    async makeBucket(bucket: string) {
        await fs.mkdir(path.join(this.basePath, bucket), { recursive: true }); 
    }

    async presignedPutObject(bucket: string, key: string, expiry: number) {
        return `${env.APP_URL}/api/upload/local?bucket=${bucket}&key=${encodeURIComponent(key)}`;
    }

    async fGetObject(bucket: string, key: string, dest: string) {
        const src = this.getFullPath(bucket, key);
        await fs.copyFile(src, dest);
    }

    async getObject(bucket: string, key: string) {
        const src = this.getFullPath(bucket, key);
        return createReadStream(src);
    }

    async getPartialObject(bucket: string, key: string, offset: number, length: number) {
        const src = this.getFullPath(bucket, key);
        return createReadStream(src, { start: offset, end: offset + length - 1 });
    }

    async fPutObject(bucket: string, key: string, src: string, meta?: any) {
        const dest = this.getFullPath(bucket, key);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(src, dest);
    }

    async putObject(bucket: string, key: string, buffer: Buffer | Uint8Array, size?: number, meta?: any) {
        const dest = this.getFullPath(bucket, key);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.writeFile(dest, buffer);
    }

    async statObject(bucket: string, key: string) {
        const dest = this.getFullPath(bucket, key);
        const stats = await fs.stat(dest);
        return { size: stats.size, lastModified: stats.mtime };
    }

    async removeObject(bucket: string, key: string) {
        try {
            const dest = this.getFullPath(bucket, key);
            await fs.unlink(dest);
        } catch (err) {}
    }

    async *listObjects(bucket: string, prefix: string, recursive: boolean) {
        const bucketPath = path.join(this.basePath, bucket);
        const targetPath = path.join(bucketPath, prefix);

        async function* walk(dir: string): AsyncGenerator<any> {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const res = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        if (recursive) yield* walk(res);
                    } else {
                        const stat = await fs.stat(res);
                        yield { name: path.relative(bucketPath, res).replace(/\\/g, '/'), size: stat.size };
                    }
                }
            } catch(e) {}
        }
        yield* walk(path.dirname(targetPath));
    }
}

export function getStorageClient(config: any | null | undefined, backendId?: string | null) {
    if (!config) {
        return { client: minioClient, bucket: BUCKET_NAME, isEnv: true };
    }

    if (backendId && clientPool.has(backendId)) {
        return { client: clientPool.get(backendId)!, bucket: config.bucket as string, isEnv: false }; 
    }

    if (config.provider === 'local') {
        const localClient = new DiskClient(config);
        if (backendId) clientPool.set(backendId, localClient);
        return { client: localClient, bucket: config.bucket as string, isEnv: false };
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