"use server";

import { db } from "@/db";
import { platformConfig } from "@/db/schema";
import { auth } from "@/server/auth";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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
    revalidatePath("/admin");
    revalidatePath("/login");
    revalidatePath("/register");
    return { success: true, newValue };
}