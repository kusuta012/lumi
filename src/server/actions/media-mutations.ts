"use server";

import { db } from "@/db";
import { media } from "@/db/schema";
import { eq, and} from "drizzle-orm";
import { auth } from "@/server/auth";
import { revalidatePath } from "next/cache";

async function verifyOwnership(mediaId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    return session.user.id;
}

export async function toggleFavoriteAction(mediaId: string, currentStatus: boolean) {
    const userId = await verifyOwnership(mediaId);
    await db.update(media)
        .set({ isFavorited: !currentStatus })
        .where(and(eq(media.id, mediaId), eq(media.ownerId, userId)));
    revalidatePath("/favorites");
    revalidatePath("/photos");
}

export async function toggleArchiveAction(mediaId: string, currentStatus: boolean) {
    const userId = await verifyOwnership(mediaId);
    await db.update(media)
        .set({ isArchived: !currentStatus })
        .where(and(eq(media.id, mediaId), eq(media.ownerId, userId)));
    revalidatePath("/archive");
    revalidatePath("/photos");
}

export async function toggleTrashAction(mediaId: string, currentStatus: boolean) {
    const userId = await verifyOwnership(mediaId);
    await db.update(media)
        .set({
            isDeleted: !currentStatus,
            deletedAt: !currentStatus ? new Date() : null
        })
        .where(and(eq(media.id, mediaId), eq(media.ownerId, userId)));
    revalidatePath("/trash");
    revalidatePath("/photos");
}