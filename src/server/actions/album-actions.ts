"use server";

import { db } from "@/db";
import { albums, albumMedia, media } from "@/db/schema";
import { auth } from "@/server/auth";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { addMediaToPipe } from "@/lib/queue";
import { redisCache } from "@/lib/cache";
import { logAuditEvent } from "@/lib/audit";


export async function addToAlbumAction(mediaIds: string[], albumName: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    try {
        const [newAlbum] = await db.insert(albums).values({
            name: albumName,
            ownerId: session.user.id,
            coverMediaId: mediaIds[0],
        }).returning();

        const entries = mediaIds.map((id) => ({
            albumId: newAlbum.id,
            mediaId: id,
        }));

        await db.insert(albumMedia).values(entries);

        await redisCache.del(`user_albums_grid:${session.user.id}`);
        revalidatePath("/albums");
        revalidatePath("/photos");

        return { success: true, albumId: newAlbum.id };
    } catch (error) {
        console.error("Failed to create album", error);
        return {success: false, error: "Failed to create alum" };
    }
}

export async function createEmptyAlbumAction(name: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    try {
        const [newAlbum] = await db.insert(albums).values({
            name,
            ownerId: session.user.id,
            coverMediaId: null,
        }).returning();
        await redisCache.del(`user_albums_grid:${session.user.id}`);
        revalidatePath("/albums");
        return { success: true, albumId: newAlbum.id};
    } catch (error) {
        return {success: false, error: "Failed to create empty album"};
    }
}

export async function addMediaToExistingAlbumAction(albumId: string, mediaIds: string[]) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    try {
        const album = await db.query.albums.findFirst({ where: eq(albums.id, albumId) });
        if (!album || album.ownerId !== session.user.id) throw new Error("Not found");

        const entries = mediaIds.map((id) => ({ albumId, mediaId: id }));
        await db.insert(albumMedia).values(entries).onConflictDoNothing();

        if (!album.coverMediaId && mediaIds.length > 0) {
            await db.update(albums).set({ coverMediaId: mediaIds[0] }).where(eq(albums.id, albumId));
        }
        await redisCache.del(`user_albums_grid:${session.user.id}`);
        revalidatePath("/albums");
        revalidatePath(`/albums/${albumId}`);
        return { success: true };
    } catch (error) {
        return { error: "Failed to adf to album"};
    }
}

export async function deleteAlbumAction(albumId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    try {
        const album = await db.query.albums.findFirst({ where: eq(albums.id, albumId) });
        await db.transaction(async (tx) => {
            await tx.delete(albumMedia).where(eq(albumMedia.albumId, albumId));
            await tx.delete(albums).where(and(eq(albums.id, albumId), eq(albums.ownerId, session.user.id)));
        });
        await redisCache.del(`user_albums_grid:${session.user.id}`);
        await logAuditEvent(
            "album_deleted",
            "album",
            albumId,
            { name: album?.name || "Unknown" }
        );
        revalidatePath("/albums", "layout");
        return { success: true };
    } catch (error) {
        console.error("ALBUM DELETE FIALED", error);
        return { success: false, error: "Failed to delete album"};
    }
}

export async function updateAlbumAction(albumId: string, data: { name?: string, description?: string, coverMediaId?: string}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    try {
        await db.update(albums)
            .set({
                ...(data.name && { name: data.name }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.coverMediaId && { coverMediaId: data.coverMediaId })
            })
            .where(and(eq(albums.id, albumId), eq(albums.ownerId, session.user.id)));

        await redisCache.del(`user_albums_grid:${session.user.id}`);
        revalidatePath("/albums");
        revalidatePath(`/albums/${albumId}`);
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to update album"};
    }
}

export async function uploadNewCoverAction(albumId: string, data: { filename: string, mimetype: string, size: number, objectKey: string }) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    try {
        const [newMedia] = await db.insert(media).values({
            ownerId: session.user.id,
            filename: data.filename,
            mimetype: data.mimetype,
            size: data.size,
            objectKey: data.objectKey,
            hash: "pending",
        }).returning();

        await addMediaToPipe(newMedia.id);
        await db.insert(albumMedia).values({ albumId, mediaId: newMedia.id });
        await db.update(albums).set({ coverMediaId: newMedia.id }).where(eq(albums.id, albumId));

        await redisCache.del(`user_albums_grid:${session.user.id}`);
        revalidatePath("/albums");
        revalidatePath(`/albums/${albumId}`);
        return { success: true };
    } catch (error) {
        console.error("cover upload error", error);
        return { success: false, error:  "Failed to upload cover"}
    }
}