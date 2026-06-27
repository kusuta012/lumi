"use server";

import { db } from "@/db";
import { platformConfig } from "@/db/schema";
import { auth } from "@/server/auth";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";

export async function getRegistrationSetting() {
    const setting = await db.query.platformConfig.findFirst({
        where: eq(platformConfig.key, 'allow_registration')
    });

    return setting ? Boolean(setting.value) : false;
}

export async function toggleRegistrationAction(currentStatus: boolean) {
    const session = await auth();
    const roleName = String(session?.user?.roleName || "")
    if (roleName !== "Super Admin") throw new Error("Unauthorized");

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
    const session = await auth();
    if (session?.user?.roleName !== "Super Admin") throw new Error("Unauthorized");
    
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