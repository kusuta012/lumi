import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/db";
import { albums, albumMedia, media } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { minioClient, BUCKET_NAME } from "@/lib/storage";
import JSZip from "jszip";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string}>}
) {
    const session = await auth();
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;
    const album = await db.query.albums.findFirst({
        where: and(eq(albums.id, id), eq(albums.ownerId, session.user.id))
    });

    if (!album) return new NextResponse("Album not found", { status: 404 });

    const links = await db.query.albumMedia.findMany({
        where: eq(albumMedia.albumId, id)
    });

    if (links.length === 0) return new NextResponse("Album is empty", { status: 400 });

    const mediaIds = links.map(l => l.mediaId);
    const photos = await db.query.media.findMany({
        where: and(inArray(media.id, mediaIds), eq(media.isDeleted, false))
    });

    const zip = new JSZip();

    try {
        await Promise.all(photos.map(async (photo) => {
            const stream = await minioClient.getObject(BUCKET_NAME, photo.objectKey);
            const chunks: any[] = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            zip.file(photo.filename, buffer);
        }));
        const content = await zip.generateAsync({
            type: "blob",
            compression: "STORE"
        });

        const safeName = album.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        return new NextResponse(content as any, {
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="${safeName}.zip"`,
                "Cache-Control": "no-cache",
            },
        });
    } catch (err) {
        console.error("zipping error", err);
        return new NextResponse("Failed to geneate download", { status: 500 });
    }
}