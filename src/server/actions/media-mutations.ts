"use server";

import { db } from "@/db";
import { albumMedia, media, albums, users } from "@/db/schema";
import { eq, and, inArray, notInArray, sql } from "drizzle-orm";
import { auth } from "@/server/auth";
import { revalidatePath } from "next/cache";
import { BUCKET_NAME, minioClient } from "@/lib/storage";
import { redisCache } from "@/lib/cache";

async function verifyOwnership(mediaId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function toggleFavoriteAction(
  mediaId: string,
  currentStatus: boolean,
) {
  const userId = await verifyOwnership(mediaId);
  await db
    .update(media)
    .set({ isFavorited: !currentStatus })
    .where(and(eq(media.id, mediaId), eq(media.ownerId, userId)));
  await redisCache.del(`user_photos_timeline:${userId}`);  

  revalidatePath("/favorites");
  revalidatePath("/photos");
}

export async function toggleArchiveAction(
  mediaId: string,
  currentStatus: boolean,
) {
  const userId = await verifyOwnership(mediaId);
  await db
    .update(media)
    .set({ isArchived: !currentStatus })
    .where(and(eq(media.id, mediaId), eq(media.ownerId, userId)));
  await redisCache.del(`user_photos_timeline:${userId}`); 
  revalidatePath("/archive");
  revalidatePath("/photos");
}

export async function toggleTrashAction(
  mediaId: string,
  currentStatus: boolean,
) {
  const userId = await verifyOwnership(mediaId);
  await db
    .update(media)
    .set({
      isDeleted: !currentStatus,
      deletedAt: !currentStatus ? new Date() : null,
    })
    .where(and(eq(media.id, mediaId), eq(media.ownerId, userId)));
  await redisCache.del(`user_photos_timeline:${userId}`); 
  revalidatePath("/trash");
  revalidatePath("/photos");
  revalidatePath("/albums", "layout");
}

export async function restoreMediaAction(mediaIds: string[]) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await db
    .update(media)
    .set({ isDeleted: false, deletedAt: null })
    .where(
      and(inArray(media.id, mediaIds), eq(media.ownerId, session.user.id)),
    );

  await redisCache.del(`user_photos_timeline:${session.user.id}`); 
  revalidatePath("/trash");
  revalidatePath("/photos");
  return { success: true };
}

export async function deletePermanentlyAction(mediaIds: string[]) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!mediaIds || mediaIds.length === 0) return { success: true };

  const items = await db
    .select()
    .from(media)
    .where(
      and(inArray(media.id, mediaIds), eq(media.ownerId, session.user.id)),
    );

  if (items.length === 0) return { success: true };

  const totalBytes = items.reduce((acc, item) => acc + item.size, 0);
  const totalMB = Math.round(totalBytes / (1024 * 1024));

  try {
    await db.transaction(async (tx) => {
      const albumsAffected = await tx
        .select()
        .from(albums)
        .where(inArray(albums.coverMediaId, mediaIds));

      for (const album of albumsAffected) {
        const nextPhoto = await tx
          .select()
          .from(albumMedia)
          .where(
            and(
              eq(albumMedia.albumId, album.id),
              notInArray(albumMedia.mediaId, mediaIds),
            ),
          )
          .limit(1);

        await tx
          .update(albums)
          .set({
            coverMediaId: nextPhoto.length > 0 ? nextPhoto[0].mediaId : null,
          })
          .where(eq(albums.id, album.id));
      }

      await tx.delete(albumMedia).where(inArray(albumMedia.mediaId, mediaIds));

      await tx
        .delete(media)
        .where(
          and(inArray(media.id, mediaIds), eq(media.ownerId, session.user.id)),
        );
      await tx
        .update(users)
        .set({
          storageUsed: sql`GREATEST(0, ${users.storageUsed} - ${totalMB})`,
        })
        .where(eq(users.id, session.user.id));
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
        console.error(
          `Failed to delete file from bucket: ${item.objectKey}`,
          err,
        );
      }
    }
    await redisCache.del(`user_photos_timeline:${session.user.id}`); 
    revalidatePath("/trash");
    revalidatePath("/photos");
    revalidatePath("/albums", "layout");
    return { success: true };
  } catch (error) {
    console.error("db delete error", error);
    throw new Error("Failed to delete media from db");
  }
}

export async function bulkMoveToTrashAction(mediaIds: string[]) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  if (!mediaIds || mediaIds.length === 0) return { success: true };

  await db
    .update(media)
    .set({ isDeleted: true, deletedAt: new Date() })
    .where(
      and(inArray(media.id, mediaIds), eq(media.ownerId, session.user.id)),
    );
  await redisCache.del(`user_photos_timeline:${session.user.id}`); 
  revalidatePath("/photos");
  revalidatePath("/albums", "layout");
  return { success: true };
}
