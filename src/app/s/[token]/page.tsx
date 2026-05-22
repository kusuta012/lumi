import { db } from "@/db";
import { shareLinks, albums, media, albumMedia, users, albumContributors } from "@/db/schema";
import { eq, inArray, desc, and } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import PublicSharedClient from "./PublicSharedClient";
import { auth } from "@/server/auth";

export default async function PublicSharePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const session = await auth();

    const link = await db.query.shareLinks.findFirst({
        where: eq(shareLinks.linkToken, token),
    });

    if (!link) notFound();

    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
                <div className="text-center space-y-4">
                    <h1 className="text-4xl font-bold text-neutral-600">Link Expired</h1>
                    <p className="text-neutral-400">This shared link is o longer active</p>
                </div>
            </div>
        );
    }

    if (session?.user) {
        if (link.targetType === 'album' && session.user.id !== link.ownerId) {
            await db.insert(albumContributors).values({
                albumId: link.targetId,
                userId: session.user.id
            }).onConflictDoNothing();
            redirect(`/albums/${link.targetId}`);
        }
    } else {
        if (link.requireLogin) {
            redirect(`/login?callbackUrl=s/${token}`);
        }
    }

    const owner = await db.query.users.findFirst({
        where: eq(users.id, link.ownerId)
    });

    let title = "Shared Media";
    let items: any[] = [];

    if (link.targetType === 'media') {
        const item = await db.query.media.findFirst({ where: eq(media.id, link.targetId) });
        if (item) {
            title = item.filename;
            items = [item];
        }
    }

    else if (link.targetType === 'album') {
        const album = await db.query.albums.findFirst({ where: eq(albums.id, link.targetId) });
        if (album) {
            title = album.name;
            const links = await db.query.albumMedia.findMany({ where: eq(albumMedia.albumId, album.id) });
            const mediaIds = links.map(l => l.mediaId);

            if (mediaIds.length > 0) {
                items = await db.query.media.findMany({
                    where: and(inArray(media.id, mediaIds), eq(media.isDeleted, false)
                ),
                orderBy: [desc(media.dateTaken), desc(media.createdAt)]
                });
            }
        }
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a]">
            <PublicSharedClient token={token} title={title} items={items} ownerName = {owner?.username || "Unknown user"} allowDownload = {link.allowDownload!} allowUpload = {link.allowUpload!} />
        </div>
    );
}