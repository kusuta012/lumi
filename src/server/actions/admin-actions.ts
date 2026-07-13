"use server";

import { db } from "@/db";
import { users, roles } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { eq, count } from "drizzle-orm";
import { redisCache } from "@/lib/cache";
import { logAuditEvent } from "@/lib/audit";
import { systemQueue } from "@/lib/queue";
import { type Permissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permissions.server";

export async function toggleUserStatus(userId: string, currentSuspension: boolean) {
    await requirePermission("can_manage_users");

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

        await logAuditEvent(
            currentSuspension ? "user_unsuspended" : "user_suspended",
            "user",
            userId
        );
        revalidatePath("/admin/users");
        return { success: true };
    } catch (error) {
        console.error("failed to toggle user status", error)
        return { success: false, error: "db update failed"}
    }
}

export async function updateUserQuotaAction(userId: string, quotaMB: number) {
    await requirePermission("can_manage_users");

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
    await requirePermission("can_manage_users");
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
    const session = await requirePermission("can_manage_users");

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

export async function triggerSystemBackup() {
    const session = await requirePermission("can_manage_server");

    try {
        await systemQueue.add("database-backup", { userId: session?.user.id });
        await logAuditEvent("system_backup_requested", "system", session?.user.id);

        return { success: true, message: "System backup queued successfully" };
    } catch (err) {
        console.error("Failed to queue system backup", err);
        return { sucess: false, error: "Failed to queue backup job" };
    }
}

export async function getAllRoles() {
    await requirePermission("can_manage_users");

    const allRoles = await db.query.roles.findMany({
        orderBy: (roles, { desc }) => [desc(roles.createdAt)]
    });

    const roleCounts = await db.select({
        roleId: users.roleId,
        userCount: count()
    })
    .from(users)
    .groupBy(users.roleId);

    const countMap = new Map(roleCounts.map(r => [r.roleId, r.userCount]));

    return allRoles.map(r => ({
        ...r,
        userCount: countMap.get(r.id) || 0
    }));
}

export async function createRole(name: string, permissions: Permissions) {
    await requirePermission("can_manage_users");

    if (!name.trim()) return { success: false, error: "Role name is required" };

    try {
        await db.insert(roles).values({
            name: name.trim(),
            isSystem: false,
            permissions
        });

        await logAuditEvent("role_created", "role", name);
        revalidatePath("/admin/roles");
        return { success: true };
    } catch (err) {
        console.error("Failed to create role", err);
        return { success: false, error: "Role name may already exist" };
    }
}

export async function updateRole(roleId: string, name: string, permissions: Permissions) {
    await requirePermission("can_manage_users");

    const role = await db.query.roles.findFirst({ where: eq(roles.id, roleId) });
    if (!role) return { success: false, error: "Role not found" };
    if (role.isSystem) return { success: false, error: "Cannot edit system roles" };

    try {
        await db.update(roles)
            .set({ name: name.trim(), permissions })
            .where(eq(roles.id, roleId));
        
        await logAuditEvent("role_updated", "role", roleId, { name });
        revalidatePath("/admin/roles");
        revalidatePath("/admin/users");
        return { success: true };
    } catch (err) {
        console.error("Failed to update role", err);
        return { success: false, error: "Failed to update role" };
    }
}

export async function deleteRole(roleId: string) {
    await requirePermission("can_manage_users");

    const role = await db.query.roles.findFirst({ where: eq(roles.id, roleId) });
    if (!role) return { success: false, error: "Role not found" };
    if (role.isSystem) return { success: false, error: "Cannot delete system roles" };

    const [assignedUsers] = await db.select({ value: count() })
        .from(users)
        .where(eq(users.roleId, roleId));

    if (assignedUsers.value > 0) {
        return { success: false, error: `Cannot delete! ${assignedUsers.value} users are still assigned to this role` };
    }

    try {
        await db.delete(roles).where(eq(roles.id, roleId));
        await logAuditEvent("role_deleted", "role", roleId, { name: role.name });
        revalidatePath("/admin/roles");
        return { success: true };
    } catch (err) {
        console.error("Failed to delete role", err);
        return { success: false, error: "Failed to delete role" };
    }
}

export async function changeUserRole(userId: string, roleId: string) {
    const session = await requirePermission("can_manage_users");

    if (userId === session.user.id) {
        return { success: false, error: "You cannot change your own role" };
    }

    const targetUser = await db.query.users.findFirst({ where: eq(users.id, userId), with: { role: true } });
    if (targetUser?.role?.name === "Super Admin") {
        return { success: false, error: "Cannot change role of a Super Admin" };
    }

    const role = await db.query.roles.findFirst({ where: eq(roles.id, roleId) });
    if (!role) return { success: false, error: "Role not ofound" };

    if (role.name === "Super Admin") {
        return { success: false, error: "Cannot assign the super admin role" };
    }

    try {
        await db.update(users)
            .set({ roleId, UpdatedAt: new Date() })
            .where(eq(users.id, userId));
        
        await redisCache.set(`revoked_session:${userId}`, "true", 86400);
        await logAuditEvent("user_role_changed", "user", userId, { newRole: role.name });
        revalidatePath("/admin/users");
        return { success: true };
    } catch (err) {
        console.error("Failed to change user role", err);
        return { success: false, error: "Failed to change role" };
    }
}