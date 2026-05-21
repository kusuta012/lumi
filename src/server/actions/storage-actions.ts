"use server";

import { db } from "@/db";
import { storageBackends, platformConfig } from "@/db/schema";
import { auth } from "@/server/auth";
import { eq, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { migrationQueue } from "@/lib/queue";
import { media } from "@/db/schema";


async function ensureSuperAdmin() {
    const session = await auth();
    if (session?.user?.roleName !== "Super Admin") throw new Error("Unauthorized");
}

export async function getMaintenanceSetting() {
    const setting = await db.query.platformConfig.findFirst({
        where: eq(platformConfig.key, 'maintenance_mode')
    });
    return setting ? Boolean(setting.value) : false;
}

export async function toggleMaintenanceMode(currentState: boolean) {
    await ensureSuperAdmin();
    const newValue = !currentState;
    await db.insert(platformConfig)
        .values({ key: 'maintenance_mode', value: newValue })
        .onConflictDoUpdate({ target: [platformConfig.key], set: { value: newValue } });
    revalidatePath("/admin");
    revalidatePath("/admin/storage");
}

export async function addStorageBackend(data: any) {
    await ensureSuperAdmin();
    await db.insert(storageBackends).values({
        name: data.name,
        type: data.type,
        config: data.config,
        isDefault: false,
        status: 'online'
    });
    revalidatePath("/admin/storage");
    return { success: true };
}

export async function setDefaultBackend(id: string) {
    await ensureSuperAdmin();
    await db.transaction(async (tx) => {
        await tx.update(storageBackends).set({ isDefault: false });
        if (id !== 'env') {
            await tx.update(storageBackends).set({ isDefault: true }).where(eq(storageBackends.id, id));
        }
    });
    revalidatePath("/admin/storage");
}

export async function triggerMigration(sourceId: string, targetId: string) {
    await ensureSuperAdmin();
    const setting = await db.query.platformConfig.findFirst({ where: eq(platformConfig.key, 'maintenance_mode') });
    if (!setting || !setting.value) {
        return { success: false, error: "maintenance mode must be enabled to run migrations safely" };
    }

    await migrationQueue.add('migrate', { sourceId, targetId });

    return { success: true };
}

export async function deleteStorageBackend(id: string) {
    await ensureSuperAdmin();
    const backend = await db.query.storageBackends.findFirst({ where: eq(storageBackends.id, id) });
    if (backend?.isDefault) {
        return { success: false, error: "cannot delete a default backend, assign a new default first" };
    }
    const [linkedMedia] = await db.select({ value: count() })
        .from(media)
        .where(eq(media.storageBackendId, id));
    
    if (linkedMedia.value > 0) {
        return {
            success: false, error: `cannot delete, the bucket still contains ${linkedMedia.value} items. Please migrate or delete them first`
        };
    }

    try {
        
        await db.delete(storageBackends).where(eq(storageBackends.id, id));
        revalidatePath("/admin/storage");
        return { success: true };
    } catch (err) {
        console.error("delete backend eror", err);
        return { success: false, error: "db error while deleting backend"};
    }
}
