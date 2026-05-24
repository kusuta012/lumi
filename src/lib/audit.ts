"use server";

import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { auth } from "@/server/auth";

export async function logAuditEvent(
    action: string,
    targetType?: string,
    targetId?: string,
    details?: any
) {
    try {
        const session = await auth();
        await db.insert(auditLogs).values({
            actorId: session?.user?.id || null,
            action: action.toUpperCase(),
            targetType,
            targetId,
            details: details ? details : null,
        });
    } catch (err) {
        console.error("failed to write audit logs", err);
    }

}