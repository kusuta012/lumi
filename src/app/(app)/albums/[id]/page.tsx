import { db } from "@/db";
import { albums, albumMedia, media, albumContributors, shareLinks } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { auth } from "@/server/auth";
import TimelineGallery from "@/components/media/TimelineGallery";
import { notFound } from "next/navigation";
import AlbumHeadersAction from "@/components/albums/AlbumHeadersActions";

export default async function AlbumDetailPage({ params }: { params: Promise<{ id: string}> }) {
    const session = await auth();
    if (!session?.user?.id) return null;

    const { id } = await params;

    const album = await db.query.albums.findFirst({
        where: eq(albums.id , id)
    });

    if (!album) notFound();

    const isOwner = album.ownerId === session.user.id;
    if (!isOwner) {
        const hasAccess = await db.query.albumContributors.findFirst({
            where: and(eq(albumContributors.albumId, album.id), eq(albumContributors.userId, session.user.id))
        });
        if (!hasAccess) notFound();
    }

    const shareLink = await db.query.shareLinks.findFirst({
        where: and(eq(shareLinks.targetId, id), eq(shareLinks.targetType, 'album'))
    })

    const allowDownload = shareLink ? Boolean(shareLink.allowDownload) : true;

    const links = await db.query.albumMedia.findMany({
        where: eq(albumMedia.albumId, id)
    });

    const mediaIds = links.map(l => l.mediaId);
    const albumPhotos = mediaIds.length > 0
        ? await db.query.media.findMany({
            where: and(inArray(media.id, mediaIds), eq(media.isDeleted, false)),
            orderBy: [desc(media.dateTaken), desc(media.createdAt)]
        })
        : [];
    const years = albumPhotos.map(m => new Date(m.dateTaken || m.createdAt).getFullYear());
    const startYear = years.length > 0 ? Math.max(...years) : new Date().getFullYear();
    const endYear = years.length > 0 ? Math.min(...years) : startYear;

    return (
        <div>
            <div className="px-8 py-10 border-b border-border flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">{album.name}</h1>
                    <p className="text-muted text-sm mt-1">{albumPhotos.length} items</p>
                </div>
                {isOwner && <AlbumHeadersAction album={album} />}
            </div>
            

            <TimelineGallery initialMedia={albumPhotos as any} startYear={startYear} endYear={endYear} emptyMessage="The album is empty" albumId={album.id} isOwner={isOwner} allowDownload={allowDownload} />
        </div>
    )

}