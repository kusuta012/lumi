"use server";

import { db } from "@/db";
import { albums, albumMedia, albumRelations } from "@/db/schema";
import { auth } from "@/server/auth";
import { revalidatePath } from "next/cache";

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

        revalidatePath("/albums");
        revalidatePath("/photos");

        return { success: true, albumId: newAlbum.id };
    } catch (error) {
        console.error("Failed to create album", error);
        return { error: "Failed to create alum" };
    }
}