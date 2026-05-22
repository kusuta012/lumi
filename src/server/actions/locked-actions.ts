"use server";

import { db } from "@/db";
import { media, users, albumMedia } from "@/db/schema";
import { eq, and , inArray } from "drizzle-orm";
import { auth } from "@/server/auth";
import { revalidatePath } from "next/cache";
import { hash, compare } from "bcrypt";
import { cookies } from "next/headers";
import { error } from "console";

async function verifyUser() {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    return session.user.id;
}

export async function getPinStatus() {
    const userId = await verifyUser();
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    return { hasPin: !!user?.lockedFolderPin };
}

export async function setLockedFolderPin(pin: string) {
    const userId = await verifyUser();
    if (pin.length !== 6 || isNaN(Number(pin))) return { success: false, error: "Pin must be 6 digits" };

    const pinHash = await hash(pin, 10);
    await db.update(users).set({ lockedFolderPin: pinHash }).where(eq(users.id, userId));
    const cookieStore = await cookies();
    cookieStore.set("lumi_locked_session", "active", { maxAge: 300, httpOnly: true });
    revalidatePath("/locked");
    return { success: true };
}

export async function unlockWithPin(pin: string) {
    const userId = await verifyUser();
    const user = await db.query.users.findFirst({ where: eq(users.id, userId)});
    if (!user || !user.lockedFolderPin) return { success: false, error: "No PIN set up" };

    const isValid = await compare(pin, user.lockedFolderPin);
    if (!isValid) return { succes: false, error: "Incorrect pin"};

    const cookieStore = await cookies();
    cookieStore.set("lumi_locked_session", "active", { maxAge: 300, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" });
    revalidatePath("/locked");
    return { success: true };
}

export async function moveToLockedFolder(mediaIds: string[]) {
    const userId = await verifyUser();
    if (!mediaIds || mediaIds.length === 0) return { success: true };

    try {
        await db.transaction(async (tx) => {
            await tx.delete(albumMedia).where(inArray(albumMedia.mediaId, mediaIds));
            await tx.update(media)
                .set({
                    isLocked: true,
                    isFavorited: false,
                    isArchived: false
                })
                .where(and(
                    inArray(media.id, mediaIds),
                    eq(media.ownerId, userId)
                ));
        });

        revalidatePath("/photos");
        revalidatePath("/favorites");
        revalidatePath("/archive");
        revalidatePath("/albums", "layout");
        return { success: true };
    } catch (err) {
        console.error("Failed to move items to locked folder", err);
        return { success: false, error: "failed to move items to locked folder"};
    }
}

export async function restoreFromLockedFolder(mediaIds: string[]) {
    const userId = await verifyUser();
    if (!mediaIds || mediaIds.length === 0) return { success: true };

    try {
        await db.update(media)
            .set({ isLocked: false })
            .where(and(
                inArray(media.id, mediaIds),
                eq(media.ownerId, userId)
            ));
        
        revalidatePath("/photos");
        revalidatePath("/locked");
        return { success: true };
    } catch (err) {
        console.error("failed to restore items from locked folder", err);
        return { success: false, error: "Failed to unlock items" };
    }
} 