"use server";

import { auth } from "@/server/auth";
import { takeoutQueue } from "@/lib/queue";
import { GtakeoutQueue } from "@/lib/queue";
import { logAuditEvent } from "@/lib/audit";

export async function requestTakeout() {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    try {
        await takeoutQueue.add("generate-zip", { userId: session.user.id });
        await logAuditEvent("takeout_requested", "system", session.user.id);

        return {
            success: true,
            message: "Takeout started, it will appear in your audit logs when finished"
        };
    } catch (err) {
        return { success: false, error: "Failed to queue backup job" };
    }
}

export async function startGtakeoutImport(zipObjectKey: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    await GtakeoutQueue.add("googlu-import", {
        userId: session.user.id,
        objectKey: zipObjectKey
    });
    await logAuditEvent("g_takeout_started", "system", session.user.id);
    return { success: true, message: "Import started... Check your library in a few minutes" };
}