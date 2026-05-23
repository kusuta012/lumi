"use server";

import { db } from "@/db";
import { users, roles } from "@/db/schema";
import { auth } from "@/server/auth";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { redisCache } from "@/lib/cache";

async function ensureSuperAdmin() {
    const session = await auth();
    const roleName = session?.user?.roleName;

    if (roleName !== "Super Admin") {
        console.error(`get out kid`)
        throw new Error("get out kid, no admin perms hahaha...")
    }
    return session;
}

export async function toggleUserStatus(userId: string, currentSuspension: boolean) {
    await ensureSuperAdmin();

    try {
        await db.update(users)
            .set({
                isSuspended: !currentSuspension,
                UpdatedAt: new Date()
            })
            .where(eq(users.id, userId));
        
        if (!currentSuspension) {
            await redisCache.set(`revoked_session:${userId}`, "true", 86400);
        } else {
            await redisCache.del(`revoked_session:${userId}`);
        }

        revalidatePath("/admin/users");
        return { success: true };
    } catch (error) {
        console.error("failed to toggle user status", error)
        return { success: false, error: "db update failed"}
    }
}

export async function updateUserQuotaAction(userId: string, quotaMB: number) {
    await ensureSuperAdmin();

    if (isNaN(quotaMB) || quotaMB < 0) {
        return { succes: false, error: "Invalid quota value"};
    }

    try {
        await db.update(users)
            .set({ storageQuota: quotaMB, UpdatedAt: new Date() })
            .where(eq(users.id, userId));

        revalidatePath("/admin/users");
        return { succes: true };
    } catch (e) {
        console.error("failed to updaer user quota", e);
        return { success: false, error: "db update failed"};
    }
}

export async function updateAllUsersQuotaAction(quotaMB: number) {
    await ensureSuperAdmin();
    if (isNaN(quotaMB) || quotaMB < 0) {
        return { success: false, error: "invalid quora value"};
    }

    try {
        await db.update(users)
            .set({
                storageQuota: quotaMB,
                UpdatedAt: new Date()
            });
            
        revalidatePath("/admin/users");
        return { success: true}
    } catch (e) {
        console.error("failed to updaer user quota", e);
        return { success: false, error: "db update failed"};
    }
}

export async function deleteUserAction(userId: string) {
    const session = await ensureSuperAdmin();

    if (userId === session?.user.id) {
        return { success: false, error: "why u want to delete yourself dear?"};
    }

    try {
        await db.delete(users).where(eq(users.id, userId));

        revalidatePath("/admin/users");
        return { success: true}
    } catch (e) {
        console.error("failed to delete user", e);
        return { success: false, error: "db update failed"};
    }
}