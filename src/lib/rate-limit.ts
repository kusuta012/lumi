import { cacheRedis } from "./cache";
import { headers } from "next/headers";

export async function checkRateLimit(action: string, limit: number, windowSeconds: number) {
    try {
        const headerList = await headers();
        const ip = headerList.get("x-forwarded-for") || headerList.get("x-real-ip") || "unknown_ip";
        const key = `ratelimit:${action}:${ip}`;
        const current = await cacheRedis.incr(key);

        if (current === 1) {
            await cacheRedis.expire(key, windowSeconds);
        }

        if (current > limit) {
            const ttl = await cacheRedis.ttl(key);
            return { allowed: false, ttl, current };
        }

        return { allowed: true, ttl: 0, current };
    } catch (err) {
        console.error("RATE limit error", err);
        return { allowed: true, ttl: 0, current: 0 };
    }
}