import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { shareLinks, albums, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getStorageClient } from "@/lib/storage";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;
    const link = await db.query.shareLinks.findFirst({
        where: eq(shareLinks.linkToken, token)
    });

    console.log("found link", JSON.stringify(link));

    // const targetType = String(link?.targetType || "").toLowerCase();

    if (!link || link.targetType !== 'album') {
        return NextResponse.json({ error: "invalid share link or not an album" }, { status: 400 });
    }

    try {
        const { filename, fileSize, contentType } = await req.json();
        if (!contentType?.startsWith("image/") && !contentType?.startsWith("video/")) {
            return NextResponse.json({ error: "invalid file type. Only images and video are allowed."}, { status: 400 });
        }
        const owner = await db.query.users.findFirst({ where: eq(users.id, link.ownerId) });
        if (!owner) return NextResponse.json({ error: "Owner not found" }, { status: 404 });

        const incomingMB = fileSize / (1024 * 1024);
        if ((owner.storageUsed || 0) + incomingMB > (owner.storageQuota || 0)) {
            return NextResponse.json({ error: "This album's storage liit has exceeded"}, { status: 403});
        }

        const album = await db.query.albums.findFirst({ where: eq(albums.id, link.targetId) });
        const { client, bucket } = getStorageClient(album?.coverMediaId ? null : null);
        const uniqueId = crypto.randomUUID();
        const ext = filename.split('.').pop();
        const objectKey = `users/${link.ownerId}/${uniqueId}.${ext}`;
        const presignedUrl = await client.presignedPutObject(bucket, objectKey, 3600);

        return NextResponse.json({ presignedUrl, objectKey });
    } catch (err) {
        console.error("public upload pre-flight error", err);
        return NextResponse.json({ error: "server error"}, { status: 500 });
    }
}