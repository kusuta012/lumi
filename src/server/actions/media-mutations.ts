"use server";

import { db } from "@/db";
import { albumMedia, media } from "@/db/schema";
import { eq, and, inArray} from "drizzle-orm";
import { auth } from "@/server/auth";
import { revalidatePath } from "next/cache";
import { BUCKET_NAME, minioClient } from "@/lib/storage";

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

export async function restoreMediaAction(mediaIds: string[]) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    await db.update(media)
        .set({ isDeleted: false, deletedAt: null })
        .where(and(
            inArray(media.id, mediaIds),
            eq(media.ownerId, session.user.id)
        ));
    
    revalidatePath("/trash");
    revalidatePath("/photos");
    return { success: true };
}

export async function deletePermanentlyAction(mediaIds: string[]) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const items = await db.query.media.findMany({
        where: and(
            inArray(media.id, mediaIds),
            eq(media.ownerId, session.user.id)
        )
    });

    for (const item of items) {
        try {
            await minioClient.removeObject(BUCKET_NAME, item.objectKey);
            if (item.thumbnails) {
                const thumbs = item.thumbnails as Record<string, string>;
                for (const path of Object.values(thumbs)) {
                    await minioClient.removeObject(BUCKET_NAME, path);
                }
            }
        } catch (err) {
            console.error(`Failed to delete file from bucket: ${item.objectKey}`, err);
        }
    }

    await db.delete(albumMedia).where(inArray(albumMedia.mediaId, mediaIds));
    await db.delete(media).where(and(
        inArray(media.id, mediaIds),
        eq(media.ownerId, session.user.id)
    ));
    revalidatePath("/trash");
    return { success: true };
}