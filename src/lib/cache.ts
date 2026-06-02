import IORedis from "ioredis";
import { env } from "./env";

const globalForRedis = globalThis as unknown as {
    cacheRedis: IORedis | undefined;
};

export const cacheRedis = globalForRedis.cacheRedis ?? new IORedis(env.REDIS_URL);

if (process.env.NODE_ENV !== "production") {
    globalForRedis.cacheRedis = cacheRedis;
}

export const redisCache = {
    async get(key: string): Promise<any | null> {
        try {
            const data = await cacheRedis.get(key);
            if (!data) return null;
            return JSON.parse(data);
        } catch {
            return null;
        }
    },

    async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
        try {
            const stringValue = JSON.stringify(value);
            if (ttlSeconds) {
                await cacheRedis.set(key, stringValue, "EX", ttlSeconds);
            } else {
                await cacheRedis.set(key, stringValue);
            }
        } catch (e) {
            console.error("REDIS Cache Set Error", e);
        }
    },

    async del(key: string): Promise<void> {
        try {
            await cacheRedis.del(key);
        } catch (e) {
            console.error("REDIS Cache Del Error", e);
        }
    }
};

export const cacheInvalid = {
    async onMediaChanged(userId: string, mediaId?: string, hasGps: boolean = false) {
        const keys = [
            `user_photos_timeline:${userId}`,
            `user_explore_highlight:${userId}`,
            `user_explore_memories:${userId}`
        ];
        if (mediaId) keys.push(`media_meta:${mediaId}`);
        if (hasGps) keys.push(`user_locations:${userId}`);

        await Promise.allSettled(keys.map(key => redisCache.del(key)));
    },
    async onAlbumChanged(userId: string) {
        await redisCache.del(`user_albums_grid:${userId}`);
    },
    async onAimetaChanged(userId: string) {
        const keys = [
            `user_explore_people:${userId}`,
            `user_explore_categories:${userId}`
        ];
        await Promise.allSettled(keys.map(key => redisCache.del(key)));
    }
};