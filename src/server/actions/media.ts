"use server";

import { db } from "@/db";
import { media, users, albums, albumMedia} from "@/db/schema";
import { auth } from "@/server/auth";
import { revalidatePath } from "next/cache";
import { addMediaToPipe } from "@/lib/queue"
import { eq, sql } from "drizzle-orm"
import { redisCache, cacheInvalid } from "@/lib/cache";
import { isFlipperEnabled } from "@/lib/flippers";
 
export async function recordMediaUpload(data: {
    filename: string;
    mimetype: string;
    size: number;
    objectKey: string;
    storageBackendId: string | null;
    albumName?: string;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const uploadsOn = await isFlipperEnabled("uploads_enabled");
    if (!uploadsOn) throw new Error("Uploads are currently disabled by the adminstrator");
    
    try {
        const sizeInMB = data.size > 0 ? Math.max(1, Math.round(data.size / (1024 * 1024))) : 0;
        await db.transaction(async (tx) => {
            const [newMedia] = await tx.insert(media).values({
                ownerId: session.user.id,
                    filename: data.filename,
                    mimetype: data.mimetype,
                    size: data.size,
                    objectKey: data.objectKey,
                    storageBackendId: data.storageBackendId,
                    hash: "pending",
            }).returning();

            await tx.update(users)
                .set({
                    storageUsed: sql`${users.storageUsed} + ${sizeInMB}`
                })
                .where(eq(users.id, session.user.id));
            if (data.albumName) {
                let targetAlbumId: string;
                const existingAlbum = await tx.query.albums.findFirst({
                    where: eq(albums.name, data.albumName)
                });
                if (existingAlbum) {
                    targetAlbumId = existingAlbum.id;
                } else {
                    const [newAlbum] = await tx.insert(albums).values({
                        ownerId: session.user.id,
                        name: data.albumName,
                        coverMediaId: newMedia.id
                    }).returning();
                    targetAlbumId = newAlbum.id;
                }
                await tx.insert(albumMedia).values({
                    albumId: targetAlbumId,
                    mediaId: newMedia.id
                }).onConflictDoNothing();
            }
            
            await addMediaToPipe(newMedia.id)
        });

        await cacheInvalid.onMediaChanged(session.user.id);
        if (data.albumName) await cacheInvalid.onAlbumChanged(session.user.id);

        revalidatePath("/photos");
        revalidatePath("/albums", "layout")
        return { success: true};
    }  catch (error) {
        console.error("database inset eror", error);
        throw new Error("failed to save media record to db")
    }
}