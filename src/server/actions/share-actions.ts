"use server";

import { db } from "@/db";
import { shareLinks, albums, albumMedia, users, media, albumContributors } from "@/db/schema";
import { auth } from "@/server/auth";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { addMediaToPipe } from "@/lib/queue";
import { eq, sql, and, ilike, not, or, notInArray } from "drizzle-orm";
import { broadcastAlbumUpdate } from "@/lib/pubsub";
import { getAlbumRole, hasPermission } from "../services/rbac";
import { cacheInvalid } from "@/lib/cache";

export async function createShareLink(data: {
    targetType: 'media' | 'album';
    targetId: string;
    allowDownload: boolean;
    allowUpload: boolean;
    requireLogin: boolean;
    expiresInDays?: number;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    if (data.targetType === 'album') {
        const role = await getAlbumRole(data.targetId, session.user.id);

        if (data.allowUpload && !hasPermission(role, 'contribute')) {
            return { success: false, error: "You do not have permission to create share link" }
        }
    }

    const token = nanoid(10);
    let expiresAt = null;
    if (data.expiresInDays) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + data.expiresInDays);
    }

    try {
        const [link] = await db.insert(shareLinks).values({
            ownerId: session.user.id,
            targetType: data.targetType,
            targetId: data.targetId,
            linkToken: token,
            allowDownload: data.allowDownload,
            allowUpload: data.allowUpload,
            requireLogin: data.requireLogin,
            expiresAt: expiresAt,
        }).returning();

        revalidatePath("/sharing");
        return { success: true, token: link.linkToken };
    } catch (err) {
        console.error("failed to create share link", err);
        return { success: false, error: "failed to generate share link"};
    }
}

export async function shareBulkMedia(mediaIds: string[], albumName: string, allowDownload: boolean, allowUpload: boolean, requireLogin: boolean, expiresInDays?: number) {
    const session = await auth();
    if (!session?.user?.id) throw new Error ("Unauthorized");
    if (!mediaIds || mediaIds.length === 0) throw new Error("No media selected");

    const token = nanoid(10);
    let expiresAt = null;
    if (expiresInDays) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    try {
        let targetId = mediaIds[0];
        let targetType: 'media' | 'album' = 'media';

        if (mediaIds.length > 1) {
            const [sharedAlbum] = await db.insert(albums).values({
                name: albumName || "Shared Collection",
                ownerId: session.user.id,
                coverMediaId: mediaIds[0]
            }).returning();

            const entries = mediaIds.map(id => ({ albumId: sharedAlbum.id, mediaId: id }));
            await db.insert(albumMedia).values(entries);

            targetId = sharedAlbum.id;
            targetType = 'album';
        }

        const [link] = await db.insert(shareLinks).values({
            ownerId: session.user.id,
            targetType, 
            targetId,
            linkToken: token,
            allowDownload,
            allowUpload,
            requireLogin,
            expiresAt,
        }).returning();

        revalidatePath("/sharing");
        return { success: true, token: link.linkToken };
    } catch (err) {
        console.error("bulk share failed", err);
        return { success: false, error: "Failed to generate share link"};
    }
}

export async function publicUploadToSharedAlbum(token: string, data: {
    filename: string;
    mimetype: string;
    size: number;
    objectKey: string;
}) {
    const link = await db.query.shareLinks.findFirst({ where: eq(shareLinks.linkToken, token) });
    if (!link || link.targetType !== 'album') throw new Error("Unauthorized");
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) throw new Error("Link expired");

    const sizeInMB = data.size > 0 ? Math.max(1, Math.round(data.size / (1024 * 1024))) : 0;

    try {
        await db.transaction(async (tx) => {
            const [newMedia] = await tx.insert(media).values({
                ownerId: link.ownerId,
                filename: data.filename,
                mimetype: data.mimetype,
                size: data.size,
                objectKey: data.objectKey,
                hash: "pending",
            }).returning();

            await tx.insert(albumMedia).values({
                albumId: link.targetId,
                mediaId: newMedia.id,
            });
            await broadcastAlbumUpdate(link.targetId);

            await tx.update(users)
                .set({ storageUsed: sql`${users.storageUsed} + ${sizeInMB}` })
                .where(eq(users.id, link.ownerId));
            await addMediaToPipe(newMedia.id)
        });

        revalidatePath(`s/${token}`);
        return { sucess: true };
    } catch (err) {
        console.error("public upload db save failed", err);
        return { success: false, error: "Failed to save upload to album"}
    }
}

export async function updateAlbumContributors(albumId: string,
    contributors: { userId: string; role: 'viewer' | 'contributor' | 'co_owner' }[]
) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const requesterRole = await getAlbumRole(albumId, session.user.id);
    if (!hasPermission(requesterRole, 'manage')) throw new Error("Forbidden");

    if (requesterRole === 'co_owner') {
        const hasEscalation = contributors.some(c => c.role === 'co_owner');
        if (hasEscalation) return { success: false, error: "Co-owners cannot grant co-owner privileges" };
    }

    try {
        await db.transaction(async (tx) => {
            await tx.delete(albumContributors).where(and(eq(albumContributors.albumId, albumId), not(eq(albumContributors.userId, session.user.id))));
            if (contributors.length > 0) {
                const others = contributors.filter(c => c.userId !== session.user.id);
                if (others.length > 0) {
                    const entries = contributors.map(c => ({ albumId, userId: c.userId, role: c.role }));
                    await tx.insert(albumContributors).values(entries);
                }
            }
        });
        await Promise.allSettled(
            contributors.map(c => cacheInvalid.onAlbumChanged(c.userId))
        );
        await broadcastAlbumUpdate(albumId);
        return { success: true };
    } catch (err) {
        console.error("Failed to update contributors", err);
        return { success: false, error: "Failed to update contributors" };
    }
}

export async function deleteShareLink(linkId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    try {
        await db.delete(shareLinks)
            .where(and(eq(shareLinks.id, linkId), eq(shareLinks.ownerId, session.user.id)));
        revalidatePath("/sharing/shared-links");
        return { sucess: true };
    } catch (err) {
        console.error("failed to delete share link", err);
        return { success: false, error: "failed to delete share lnik" };
    }
}

export async function searchUsersAction(query: string, albumId?: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    if (!query || query.length < 2) return { success: true, users: [] };

    try {

        let excludedIds = [session.user.id];
        if (albumId) {
            const existing = await db.select({ id: albumContributors.userId })
                .from(albumContributors).where(eq(albumContributors.albumId, albumId));
            excludedIds.push(...existing.map(e => e.id));
        }

        const foundUsers = await db.select({
            id: users.id,
            username: users.username,
            email: users.email
        })
        .from(users)
        .where(and(
            notInArray(users.id, excludedIds),
            or(
                ilike(users.username, `%${query}%`),
                ilike(users.email, `%${query}%`)
            )
        ))
        .limit(5);
        return { success: true, users: foundUsers };
    } catch (err) {
        console.error("Search users failed", err);
        return { success: false, error: "Failed to search users" };
    }
}

export async function getAlbumContributors(albumId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    try {
        const contributors = await db.select({
            id: users.id,
            username: users.username,
            role: albumContributors.role
        })
        .from(albumContributors)
        .innerJoin(users, eq(users.id, albumContributors.userId))
        .where(eq(albumContributors.albumId, albumId));

        return { success: true, contributors };
    } catch (err) {
        return { success: false, error: "Failed to load contributors" };
    }
}

