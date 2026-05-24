import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { shareLinks, albumMedia, media } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getStorageClient } from "@/lib/storage";
import { redisCache } from "@/lib/cache";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ token: string, mediaId: string}> }
) {
    const { token, mediaId } = await params;
    const { searchParams } = new URL(req.url);
    const size = searchParams.get("size") || "original";
    const link = await db.query.shareLinks.findFirst({
        where: eq(shareLinks.linkToken, token)
    });
    if (!link) return new NextResponse("invalid link", { status: 404 });
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return new NextResponse("Link expired", { status: 410 });
    }

    if (link.targetType === 'media') {
        if (link.targetId !== mediaId) return new NextResponse("Unauthorized", { status: 401 });
    } else if (link.targetType === 'album') {
        const inAlbum = await db.query.albumMedia.findFirst({
            where: and (eq(albumMedia.albumId, link.targetId), eq(albumMedia.mediaId, mediaId))
        });
        if (!inAlbum) return new NextResponse("Unauthorized", { status: 401 });
    }

    const cacheKey = `media_meta:${mediaId}`;
    let item = await redisCache.get(cacheKey);

    if (!item) {
        item = await db.query.media.findFirst({
            where: eq(media.id, mediaId),
            with: { storageBackend: true }
        });
        if (item) {
            await redisCache.set(cacheKey, item, 86400);
        }
    }

    if (!item) return new NextResponse("Not found", { status: 404 });

    try {
        const { client, bucket } = getStorageClient(item.storageBackend?.config, item.storageBackendId);
        let objectKey = item.objectKey;

        if (size !== "original" && item.thumbnails) {
            const thumbs = item.thumbnails as Record<string, string>;
            if (thumbs[size]) objectKey = thumbs[size];
        }

        const range = req.headers.get("range");
        if (item.mimetype.startsWith("video/") && range && size === "original") {
            const stat = await client.statObject(bucket, objectKey);
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
            const stream = await client.getPartialObject(bucket, objectKey, start, end - start + 1);
            return new NextResponse(stream as any, {
                status: 206,
                headers: {
                    "Content-Range": `bytes ${start}-${end}/${stat.size}`,
                    "Accept-Ranges": "bytes",
                    "Content-Length": (end - start + 1).toString(),
                    "Content-Type": item.mimetype
                },
            });
        }
        try {
            const dataStream = await client.getObject(bucket, objectKey);
            return new NextResponse(dataStream as any, {
                headers: {
                    "Content-Type": size === "original" ? item.mimetype : "image/webp",
                    "Cache-Control": "public, max-age=86400",
                },
            });
        } catch (err: any) {
            if (err.code === 'NoSuchKey' && size !== "original") {
                const fallbackStream = await client.getObject(bucket, item.objectKey);
                return new NextResponse(fallbackStream as any, {
                    headers: {
                        "Content-Type": item.mimetype,
                        "Cache-Control": "public, max-age=86400",
                    },
                });
            }
            throw err;
            }
        } catch (err) {
            console.error("shared proxy error", err);
            return new NextResponse("Error fetching media", { status: 500 }); // I'm so tired 
    }
}