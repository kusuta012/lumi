"use server";

import { auth } from "@/server/auth";
import { takeoutQueue } from "@/lib/queue";
import { GtakeoutQueue } from "@/lib/queue";
import { logAuditEvent } from "@/lib/audit";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { eq, and , gt } from "drizzle-orm";
import { subHours } from "date-fns";
import { isFlipperEnabled } from "@/lib/flippers";

export async function requestTakeout() {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const takeoutEnabled = await isFlipperEnabled("takeouts_enabled");
    if (!takeoutEnabled) return { success: false, error: "Data exports are temporarily disabled to conserve server resources" };

    try {
        const recentRequest = await db.query.auditLogs.findFirst({
            where: and(
                eq(auditLogs.actorId, session.user.id),
                eq(auditLogs.action, "TAKEOUT_REQUESTED"),
                gt(auditLogs.createdAt, subHours(new Date(), 24))
            )
        });

        if (recentRequest) {
            return { success: false, error: "You already have an export processing or completed from the last 24 hours." };
        }

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

    const takeoutEnabled = await isFlipperEnabled("takeouts_enabled");
    if (!takeoutEnabled) return { success: false, error: "Imports are temporarily disabled to conserve server resources" };

    try {
        await GtakeoutQueue.add("googlu-import", {
            userId: session.user.id,
            objectKey: zipObjectKey
        });
        await logAuditEvent("g_takeout_started", "system", session.user.id);
        return { success: true, message: "Import started... Check your library in a few minutes" };
    } catch (err) {
        console.error("Failed to queue import", err);
        return { success: false, message: "", error: "Failed to queue import job" };
    }
}