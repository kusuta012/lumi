import { cacheRedis } from "./cache";
import crypto from 'crypto';

const DEFAULT_NUM_HASHES = 10;
const DEFAULT_BIT_SIZE = 1_000_000;

function getHashOffsets(value: string, numHashes: number, bitSize: number): number[] {
    const h1 = parseInt(
        crypto.createHash("md5").update(value).digest("hex").slice(0, 8),
        16
    );
    const h2 = parseInt(
        crypto.createHash("md5").update(value + ":salt").digest("hex").slice(0, 8),
        16
    );

    const offsets: number[] = [];
    for (let i = 0; i < numHashes; i++) {
        offsets.push(Math.abs((h1 + i * h2) % bitSize));
    }

    return offsets;
}

export const bloomFilter = {
    async add(filterKey: string, value: string): Promise<void> {
        const normalized = value.trim().toLowerCase();
        const offsets = getHashOffsets(normalized, DEFAULT_NUM_HASHES, DEFAULT_BIT_SIZE);
        const pipeline = cacheRedis.pipeline();
        for (const offset of offsets) {
            pipeline.setbit(filterKey, offset, 1);
        }
        await pipeline.exec();
    },

    async mightExist(filterKey: string, value: string): Promise<boolean> {
        const normalized = value.trim().toLowerCase();
        const offsets = getHashOffsets(normalized, DEFAULT_NUM_HASHES, DEFAULT_BIT_SIZE);
        const pipeline = cacheRedis.pipeline();
        for (const offset of offsets) {
            pipeline.getbit(filterKey, offset);
        }
        const results = await pipeline.exec();
        if(!results) return true;

        for (const [err, val] of results) {
            if (err || val === 0) return false;
        }
        return true;
    },

    async rebuild(filterKey: string, values: string[]): Promise<number> {
        await cacheRedis.del(filterKey);
        const pipeline = cacheRedis.pipeline();
        for (const value of values) {
            const normalized = value.trim().toLowerCase();
            const offsets = getHashOffsets(normalized, DEFAULT_BIT_SIZE, DEFAULT_NUM_HASHES);
            for (const offset of offsets) {
                pipeline.setbit(filterKey, offset, 1);
            }
        }
        await pipeline.exec();
        return values.length;
    },
};


export const BLOOM_KEYS = {
    USERNAMES: "bloom:usernames",
    EMAILS: "bloom:emails",
} as const;