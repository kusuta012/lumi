import { db } from "@/db";
import { platformConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redisCache } from "./cache";
import { FLIPPER_DEFAULTS, type FlipperKey } from "./flipper-constants";

const CACHE_KEY = "platform:flippers";
const CACHE_TTL = 60;

export async function getFlippers(): Promise<Record<FlipperKey, boolean>> {
    const cached = await redisCache.get(CACHE_KEY);
    if (cached) return cached as Record<FlipperKey, boolean>;

    const row = await db.query.platformConfig.findFirst({
        where: eq(platformConfig.key, "feature_flippers"),
    });

    const merged = { ...FLIPPER_DEFAULTS, ...(row?.value as any || {}) };
    await redisCache.set(CACHE_KEY, merged, CACHE_TTL);
    return merged;
}

export async function isFlipperEnabled(key: FlipperKey): Promise<boolean> {
    const flippers = await getFlippers();
    return flippers[key] ?? FLIPPER_DEFAULTS[key];
}       