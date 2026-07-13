"use server";

import { db } from "@/db";
import { platformConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/permissions.server";
import { logAuditEvent } from "@/lib/audit";
import type { FlipperKey } from "@/lib/flipper-constants";
import { FLIPPER_DEFAULTS, FLIPPER_COOLDOWNS, FLIPPER_META } from "@/lib/flipper-constants";
import { cacheRedis, redisCache } from "@/lib/cache";

export async function getRegistrationSetting() {
    const setting = await db.query.platformConfig.findFirst({
        where: eq(platformConfig.key, 'allow_registration')
    });

    return setting ? Boolean(setting.value) : false;
}

export async function toggleRegistrationAction(currentStatus: boolean) {
    await requirePermission("can_change_config")

    const newValue = !currentStatus;
    await db.insert(platformConfig)
        .values({ key: 'allow_registration', value: newValue })
        .onConflictDoUpdate({ target: [platformConfig.key], set: { value: newValue, updatedAt: new Date() }
        });
    await logAuditEvent(
        "registration_toggle",
        "config",
        "allow_registration",
        { enabled: newValue }
    );
    revalidatePath("/admin");
    revalidatePath("/login");
    revalidatePath("/register");
    return { success: true, newValue };
}

export async function getVidTranscodeSettings() {
    const setting = await db.query.platformConfig.findFirst({
        where: eq(platformConfig.key, 'video_transcoding')
    });

    return setting ? (setting.value as any) : {
        enableHevc: true,
        enableLarge: true,
        largeThresholdMB: 50,
        enableLong: true,
        longThresholdSec: 60
    };
}

export async function updateVidTranscodeSettings(newSettings: any) {
    await requirePermission("can_change_config");
    
    await db.insert(platformConfig)
        .values({ key: 'video transcoding', value: newSettings })
        .onConflictDoUpdate({
            target: [platformConfig.key],
            set: { value: newSettings, updatedAt: new Date() }
        });

    await logAuditEvent("transcode_settings_updated", "config", "video_transcoding", newSettings);
    revalidatePath("/admin");
    return { success: true };
}

export async function getAiSettings() {
    const setting = await db.query.platformConfig.findFirst({
        where: eq(platformConfig.key, 'ai_settings')
    });
    return setting?.value ?? {
        clip_enabled: true,
        face_detection_enabled: true,
        ocr_enabled: true,
        aesthetic_scoring_enabled: true,
        auto_tagging_enabled: true,
        face_confidence_threshold: 0.85,
        face_distance_threshold: 0.40,
    };
}

export async function updateAiSetting(newSettings: any) {
    await requirePermission("can_change_config");

    await db.insert(platformConfig)
        .values({ key: 'ai_settings', value: newSettings })
        .onConflictDoUpdate({
            target: [platformConfig.key],
            set: { value: newSettings, updatedAt: new Date() }
        });
    
    await logAuditEvent("ai_settings_updated", "config", "ai_settings", newSettings);
    revalidatePath("/admin");
    return { success: true };
}

export async function getFlipperSettings(): Promise<Record<FlipperKey, boolean>> {
    const row = await db.query.platformConfig.findFirst({
        where: eq(platformConfig.key, "feature_flippers"),
    });
    return { ...FLIPPER_DEFAULTS, ...(row?.value as any || {}) };
}

export async function updateFlippers(newState: Record<FlipperKey, boolean>) {
    await requirePermission("can_manage_flippers");

    const currentState = await getFlipperSettings();
    const changedKeys = (Object.keys(newState) as FlipperKey[]).filter(
        key => newState[key] !== currentState[key]
    );

    for (const key of changedKeys) {
        const onCooldown = await cacheRedis.get(`flipper_cooldown:${key}`);
        if (onCooldown) {
            const ttl = await cacheRedis.ttl(`flipper_cooldown:${key}`);
            const meta = FLIPPER_META.find(m => m.key === key);
            const label = meta ? meta.label : key;
            return { success: false, error: `"${label}" is on cooldown, Try again in ${ttl} seconds` };
        }
    }
    await db.insert(platformConfig)
        .values({ key: "feature_flippers", value: newState })
        .onConflictDoUpdate({
            target: [platformConfig.key],
            set: { value: newState, updatedAt: new Date() },
        });

    const pipeline = cacheRedis.pipeline();
    for (const key of changedKeys) {
        const cooldown = FLIPPER_COOLDOWNS[key];
        if (cooldown > 0) {
            pipeline.set(`flipper_cooldown:${key}`, "locked", "EX", cooldown);
        }
    }
    pipeline.del("platform:flippers");
    await pipeline.exec();
    
    await logAuditEvent("flippers_updated", "config", "feature_flippers", newState);
    revalidatePath("/admin");
    return { success: true };
}