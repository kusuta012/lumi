import IORedis from "ioredis";
import { env } from "@/lib/env";

export const redisPublisher = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null
});

export async function broadcastAlbumUpdate(albumId: string) {
    await redisPublisher.publish(`album:${albumId}`, JSON.stringify({ type: "UPDATE", timestamp: Date.now() }));
}