"use server";

import { auth } from "@/server/auth";
import { takeoutQueue } from "@/lib/queue";
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
