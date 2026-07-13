"use server";

import { db } from "@/db";
import { storageBackends, platformConfig } from "@/db/schema";
import { requirePermission } from "@/lib/permissions.server";
import { eq, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { migrationQueue } from "@/lib/queue";
import { media } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";


export async function getMaintenanceSetting() {
    const setting = await db.query.platformConfig.findFirst({
        where: eq(platformConfig.key, 'maintenance_mode')
    });
    return setting ? Boolean(setting.value) : false;
}

export async function toggleMaintenanceMode(currentState: boolean) {
    await requirePermission("can_manage_server")
    const newValue = !currentState;
    await db.insert(platformConfig)
        .values({ key: 'maintenance_mode', value: newValue })
        .onConflictDoUpdate({ target: [platformConfig.key], set: { value: newValue } });
    revalidatePath("/admin");
    revalidatePath("/admin/storage");
}

export async function addStorageBackend(data: { name: string, type: string, config: any}) {
    const session = await requirePermission("can_manage_server")
    try {
        await db.insert(storageBackends).values({
            name: data.name,
            type: data.type,
            config: data.config,
            isDefault: false,
            status: 'online'
        });

        await logAuditEvent("storage_added", "system", data.name, { actor: session.user?.name });
        revalidatePath("/admin/storage");
        return { success: true };
    } catch (err) {
        console.error("failed to add storage backend", err);
        return { success: false, error: "Failed to add storage backend" };
    }
}

export async function setDefaultBackend(backendId: string | null) {
    const session = await requirePermission("can_manage_server")
    try {
        await db.transaction(async (tx) => {
            await tx.update(storageBackends).set({ isDefault: false });
            if (backendId) {
                await tx.update(storageBackends).set({ isDefault: true }).where(eq(storageBackends.id, backendId));
            }
        });

        await logAuditEvent("storage_default_changed", "system", backendId || "ENV_DEFAULT", { actor: session.user?.name });
        revalidatePath("/admin/storage");
        return { success: true };
    } catch (err) {
        console.error("Failed to set default storage", err);
        return { success: false, error: "failed to set default storage" };
    }
}

export async function triggerMigration(sourceId: string, targetId: string) {
    const session = await requirePermission("can_manage_server")
    try {
        const setting = await db.query.platformConfig.findFirst({ where: eq(platformConfig.key, 'maintenance_mode') });
        if (setting?.value === true) {
        return { success: false, error: "maintenance mode must be enabled to run migrations safely" };
    }
        await db.insert(platformConfig)
            .values({ key: 'maintenance_mode', value: true })
            .onConflictDoUpdate({ target: platformConfig.key, set: { value: true } });
        await migrationQueue.add('migrate', { sourceId, targetId });
        await logAuditEvent("migration_started", "system", `${sourceId}->${targetId}`, { actor: session.user?.name });

        revalidatePath("/admin/storage");
        revalidatePath("/admin/workers");
        return { success: true };
    } catch (err) {
        console.error("Failed to trigger migration", err);
        await db.update(platformConfig).set({ value: false }).where(eq(platformConfig.key, 'maintenance_mode'));
        return { success: false, error: "Failed to trigger migration" };
    }
}

export async function deleteStorageBackend(backendId: string) {
    await requirePermission("can_manage_server")
    
    // try {
    //     const [activeFiles] = await db.select({ value: count() })
    //         .from(media)
    //         .where(eq(media.storageBackendId, backendId));
        
    //         if (activeFiles.value > 0) {}
    // }
    const backend = await db.query.storageBackends.findFirst({ where: eq(storageBackends.id, backendId) });
    if (backend?.isDefault) {
        return { success: false, error: "cannot delete a default backend, assign a new default first" };
    }
    const [linkedMedia] = await db.select({ value: count() })
        .from(media)
        .where(eq(media.storageBackendId, backendId));
    
    if (linkedMedia.value > 0) {
        return {
            success: false, error: `cannot delete, the bucket still contains ${linkedMedia.value} items. Please migrate or delete them first`
        };
    }

    try {
        
        await db.delete(storageBackends).where(eq(storageBackends.id, backendId));
        revalidatePath("/admin/storage");
        return { success: true };
    } catch (err) {
        console.error("delete backend eror", err);
        return { success: false, error: "db error while deleting backend"};
    }
}
