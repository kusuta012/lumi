import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/db";
import { media } from "@/db/schema"
import { eq } from "drizzle-orm";
import { minioClient, BUCKET_NAME } from "@/lib/storage";

export async function GET(
    req: NextRequest, 
    { params }: { params: Promise<{ id: string}> }
) {
    const session  = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const size = searchParams.get("size") || "original";
    const item = await db.query.media.findFirst({
        where: eq(media.id, id),
    });

    if (!item) return new NextResponse("Not found", { status: 404 })
    if (item.ownerId !== session.user.id) {
        return new NextResponse("Forbiddedn", { status: 403 });
    }

    try {
        let objectKey = item.objectKey;
        if (size !== "original" && item.thumbnails) {
            const thumbs = item.thumbnails as Record<string, string>;
            if (thumbs[size]) {
                objectKey = thumbs[size];
            }
        }

        const range = req.headers.get("range");
        if (item.mimetype.startsWith("video/") && range && size === "original") {
            const stat = await minioClient.statObject(BUCKET_NAME, objectKey);
            const parts = range.replace(/bytes=/, "").split("-");
            const start  = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

            const stream = await minioClient.getPartialObject(BUCKET_NAME, objectKey, start, end - start + 1);
            return new NextResponse(stream as any, {
                status: 206,
                headers: {
                    "Content-Range": `bytes ${start}-${end}/${stat.size}`,
                    "Accept-Range": "bytes",
                    "Content-Length": (end - start + 1).toString(),
                    "Content-Type": item.mimetype,
                },
            });
        }

        const dataStream = await minioClient.getObject(BUCKET_NAME, objectKey);
        return new NextResponse(dataStream as any, {
            headers: {
                "Content-Type": size === "original" ? item.mimetype : "image/webp",
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch (err) {
        console.error("Proxy serror", err);
        return new NextResponse("Error fetching media", { status: 500 });
    }
}