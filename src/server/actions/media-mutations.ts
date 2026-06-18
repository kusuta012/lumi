"use server";

import { db } from "@/db";
import { albumMedia, media, albums, users, tags, mediaTags } from "@/db/schema";
import { eq, and, inArray, notInArray, sql, count, lt } from "drizzle-orm";
import { auth } from "@/server/auth";
import { revalidatePath } from "next/cache";
import { getStorageClient } from "@/lib/storage";
import { redisCache, cacheInvalid, cacheRedis } from "@/lib/cache";
import { subDays } from "date-fns";

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
    await cacheInvalid.onMediaChanged(userId, mediaId)
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
  await cacheInvalid.onMediaChanged(userId, mediaId)
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
  await cacheInvalid.onMediaChanged(userId, mediaId, true);
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

  await cacheInvalid.onMediaChanged(session.user.id, undefined, true);
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

  const verifiedIds = items.map(i => i.id);
  const result = await purgeMediaItemsSys(verifiedIds, session.user.id);
  if (result.success) {
    await cacheInvalid.onMediaChanged(session.user.id, undefined, true);
    if (verifiedIds.length > 0) {
      const pipeline = cacheRedis.pipeline();
      verifiedIds.forEach(id => pipeline.del(`media_meta:${id}`));
      await pipeline.exec();
    }
  }

  return result;
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
  await cacheInvalid.onMediaChanged(session.user.id, undefined, true);
  revalidatePath("/photos");
  revalidatePath("/albums", "layout");
  return { success: true };
}

export async function purgeMediaItemsSys(mediaIds: string[], userId: string) {
  const items = await db.query.media.findMany({
    where: and(
      inArray(media.id, mediaIds),
      eq(media.ownerId, userId)
    ),
    with: { storageBackend: true }
  });

  if (items.length === 0) return { success: true };

  const totalBytes = items.reduce((acc, item) => acc + item.size, 0);
  const totalMB = Math.round(totalBytes / (1024 * 1024));

  try {
    await db.transaction(async (tx) => {
      const albumsAffected = await tx.select().from(albums).where(
        inArray(albums.coverMediaId, mediaIds)
      );

      for (const album of albumsAffected) {
        const nextPhoto = await tx.select().from(albumMedia)
          .where(
            and(
              eq(albumMedia.albumId, album.id),
              notInArray(albumMedia.mediaId, mediaIds)
            )
          )
          .limit(1);

        await tx.update(albums)
          .set({ coverMediaId: nextPhoto.length > 0 ? nextPhoto[0].mediaId : null })
          .where(eq(albums.id, album.id));
      }
      await tx.delete(albumMedia).where(inArray(albumMedia.mediaId, mediaIds));
      await tx.delete(media).where(and(inArray(media.id, mediaIds), eq(media.ownerId, userId)));
      await tx.update(users).set({
        storageUsed: sql`GREATEST(0, ${users.storageUsed} - ${totalMB})`
      })
      .where(eq(users.id, userId));
    });

    for (const item of items) {
      try {
        const [remaining] = await db.select({ value: count() })
          .from(media)
          .where(eq(media.hash, item.hash));
          
        if (remaining.value > 0) {
          continue;
        }

        const {client, bucket} = getStorageClient(item.storageBackend?.config);
        await client.removeObject(bucket, item.objectKey);
        if (item.thumbnails) {
          const thumbs = item.thumbnails as Record<string, string>;
          for (const thumbPath of Object.values(thumbs)) {
            await client.removeObject(bucket, thumbPath);
          }
        }
      } catch (err) {
        console.error(`failed to delete from bucket ${item.objectKey}`, err);
      }
    }

    revalidatePath("/trash");
    revalidatePath("/photos");
    revalidatePath("/albums", "layout");
    return { success: true };
  } catch (err) {
    console.error("sys purge failed", err);
    return { success: false, error: "sys purge failed" };
  }
}

export async function cleanExpiredTrash() {
  const thirtDaysAgo = subDays(new Date(), 30);
  try {
    const expiredItems = await db.select().from(media).where(
      and(
        eq(media.isDeleted, true),
        lt(media.deletedAt, thirtDaysAgo)
      )
    );

    if (expiredItems.length === 0) {
      return;
    }

    const itemsByOwner = expiredItems.reduce<Record<string, string[]>>((acc, item) => {
        if(!acc[item.ownerId]) acc[item.ownerId] = [];
        acc[item.ownerId].push(item.id);
        return acc;
    }, {});

    for (const [ownerId, ids] of Object.entries(itemsByOwner)) {
      await purgeMediaItemsSys(ids, ownerId);
      await cacheInvalid.onMediaChanged(ownerId, undefined, true);
      if (ids.length > 0) {
        const pipeline = cacheRedis.pipeline();
        ids.forEach(id => pipeline.del(`media_meta:${id}`));
        await pipeline.exec();
      }
    }
  } catch (err) {
    console.error("trash clean failed", err);
  }
}

export async function getTags(mediaId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  try {
    const results = await db.select({
        id: tags.id,
        name: tags.name
    })
    .from(tags)
    .innerJoin(mediaTags, eq(mediaTags.tagId, tags.id))
    .where(eq(mediaTags.mediaId, mediaId));
    
    return { success: true, tags: results };
  } catch (err) {
    console.error("failed to get tags", err);
    return { success: false, error: "Failed to load tags" };
  }
}

export async function addTags(mediaId: string, tagName: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const cleanTagName = tagName.trim().toLowerCase();
  if (!cleanTagName) return { success: false, error: "tag cannot be empty" };

  try {

    const item = await db.query.media.findFirst({
      where: and(eq(media.id, mediaId), eq(media.ownerId, session.user.id))
    });
    if (!item) return { success: false, error: "media not found" };

    const currentTagsCnt = await db.select({ count: sql<number>`count(*)::int` })
      .from(mediaTags)
      .where(eq(mediaTags.mediaId, mediaId));

    if (currentTagsCnt[0]?.count >= 5) {
      return { success: false, error: "max limit of tags reached"};
    }

    let tagId: string;
    const existingTag = await db.query.tags.findFirst({
      where: and(eq(tags.name, cleanTagName), eq(tags.ownerId, session.user.id))
    });

    if (existingTag) {
      tagId = existingTag.id;
    } else {
      const [newTag] = await db.insert(tags).values({
        ownerId: session.user.id,
        name: cleanTagName
      }).returning({ id: tags.id });
      tagId = newTag.id;
    }

    await db.insert(mediaTags).values({
      mediaId,
      tagId
    }).onConflictDoNothing();
    
    await cacheInvalid.onAimetaChanged(session.user.id);
    return { success: true, tag: { id: tagId, name: cleanTagName }};
  } catch (err) {
    console.error("failed to add tag", err);
    return { success: false, error: "failed to add tag " };
  }
}

export async function removeTag(mediaId: string, tagId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  try {
    const item = await db.query.media.findFirst({
      where: and(eq(media.id, mediaId), eq(media.ownerId, session.user.id))
    });
    if (!item) return { success: false, error: "Media not found" };

    await db.delete(mediaTags)
      .where(and(eq(mediaTags.mediaId, mediaId), eq(mediaTags.tagId, tagId)));
    await cacheInvalid.onAimetaChanged(session.user.id);
    return { success: true };
  } catch (err) {
    console.error("failed to remove tag", err);
    return { success: false, error: "failed to remove tag" };
  }
}

export async function bulkAddTags(mediaIds: string[], tagNames: string[]) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (mediaIds.length === 0 || tagNames.length === 0 ) return { success: true };

  try {
    await db.transaction(async (tx) => {
      for (const mediaId of mediaIds) {
        const item = await tx.query.media.findFirst({
          where: and(eq(media.id, mediaId), eq(media.ownerId, session.user.id))
        });
        if (!item) continue;
        for (const name of tagNames) {
          const cleanName = name.trim().toLowerCase();
          if (!cleanName) continue;

          const currentTagsCnt = await tx.select({ count: sql<number>`count(*)::int` })
            .from(mediaTags)
            .where(eq(mediaTags.mediaId, mediaId));
          
          if (currentTagsCnt[0]?.count >= 5) continue;

          let tagId: string;
          const existingTag = await tx.query.tags.findFirst({
            where: and(eq(tags.name, cleanName), eq(tags.ownerId, session.user.id))
          });

          if (existingTag) {
            tagId = existingTag.id;
          } else {
            const [newTag] = await tx.insert(tags).values({
              ownerId: session.user.id,
              name: cleanName
            }).returning({ id: tags.id });
            tagId = newTag.id;
          }
          await tx.insert(mediaTags).values({ mediaId, tagId }).onConflictDoNothing();
          }
        }
    });
    await cacheInvalid.onAimetaChanged(session.user.id);
    return { success: true };
  } catch (err) {
    console.error("bulk tagging failed", err);
    return { success: false, error: "failed to apply bulk tags" };
  }
}