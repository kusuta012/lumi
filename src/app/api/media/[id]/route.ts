import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/db";
import { media, albums, albumMedia, albumContributors } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm";
import { getStorageClient } from "@/lib/storage";
import { redisCache } from "@/lib/cache";

export async function GET(
    req: NextRequest, 
    { params }: { params: Promise<{ id: string}> }
) {
    const session  = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const isDownload = searchParams.get("download") === "true";
    const size = searchParams.get("size") || "original";
    const hlsFile = searchParams.get("hls");

    const cacheKey = `media_meta:${id}`;
    let item = await redisCache.get(cacheKey);
    if (!item) {
        item = await db.query.media.findFirst({
            where: eq(media.id, id),
            with: { storageBackend: true }
        });

        if (item) {
            await redisCache.set(cacheKey, item, 86400);
        }
    }
    
    if (!item) return new NextResponse("Not found", { status: 404 })
    const isOwner = item.ownerId === session.user.id;
    let hasSharedAccess = false;

    if (!isOwner) {
        const sharedAccess = await db.select({ id: albums.id })
            .from(albums)
            .innerJoin(albumMedia, eq(albums.id, albumMedia.albumId))
            .innerJoin(albumContributors, eq(albums.id, albumContributors.albumId))
            .where(and(eq(albumMedia.mediaId, id), eq(albumContributors.userId, session.user.id)
        ));
        hasSharedAccess = sharedAccess.length > 0;
    }

    if (!isOwner && !hasSharedAccess) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const { client, bucket } = getStorageClient(item.storageBackend?.config, item.storageBackendId);
        let objectKey = item.objectKey;
        let contentType = item.mimetype;

        if (hlsFile) {
            objectKey = `hls/${item.ownerId}/${item.id}/${hlsFile}`;
            contentType = hlsFile.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t";
            if (hlsFile.endsWith(".m3u8")) {
                const stream = await client.getObject(bucket, objectKey);
                const chunks: Buffer[] = [];
                for await (const chunk of stream) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
                let playlist = Buffer.concat(chunks).toString("utf-8");
                playlist = playlist.replace(/(segment_\d+\.ts)/g, `/api/media/${id}?hls=$1`);
                return new NextResponse(playlist, {
                    headers: {
                        "Content-Type": "application/vnd.apple.mpegurl",
                        "Cache-Control": "public, max-age=300, immutable",
                    },
                });
            }
        }

        else if (size === "sprite") {
            if (!item.hoverSpriteKey) {
                return new NextResponse("Sprite not generated", { status: 404 });
            }
            objectKey = item.hoverSpriteKey;
            contentType = "image/webp";
        }

        else if (size !== "original" && item.thumbnails) {
            const thumbs = item.thumbnails as Record<string, string>;
            if (thumbs[size]) {
                objectKey = thumbs[size];
                contentType = "image/webp";
            }
        }

        const range = req.headers.get("range");
        if (item.mimetype.startsWith("video/") && range && size === "original" && !hlsFile) {
            const stat = await client.statObject(bucket, objectKey);
            const parts = range.replace(/bytes=/, "").split("-");
            const start  = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

            const stream = await client.getPartialObject(bucket, objectKey, start, end - start + 1);
            return new NextResponse(stream as any, {
                status: 206,
                headers: {
                    "Content-Range": `bytes ${start}-${end}/${stat.size}`,
                    "Accept-Ranges": "bytes",
                    "Content-Length": (end - start + 1).toString(),
                    "Content-Type": contentType,
                },
            });
        }

        try {
           const dataStream = await client.getObject(bucket, objectKey);
           const headers: any = {
                "Content-Type": size === "original" ? item.mimetype : "image/webp",
                "Cache-Control": "public, max-age=31536000, immutable",
            };

            if (isDownload) {
                headers["Content-Dispositon"] = `attachment; filename="${item.filename}"`;
            }
                return new NextResponse(dataStream as any, { headers }); 
        } catch (err: any) {
            if (err.code === 'NoSuchKey' && size !== "original" && !hlsFile) {
                if (item.mimetype.startsWith("video/")) {
                    return new NextResponse("Video thumbnail processing", { status: 404 });
                }

                const fallbackStream = await client.getObject(bucket, item.objectKey);
                return new NextResponse(fallbackStream as any, {
                    headers: {
                        "Content-Type": item.mimetype,
                        "Cache-Control": "no-store, must-revalidate",
                    },
                });
            }
            throw err;
        }
    } catch (err) {
        console.error("Proxy serror", err);
        return new NextResponse("Error fetching media", { status: 500 });
    }
}