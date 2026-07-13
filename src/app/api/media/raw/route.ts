import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { getStorageClient } from "@/lib/storage";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const bucket = searchParams.get("bucket");

    if (!key || !bucket) return new NextResponse("Missing params", { status: 400 });

    if (key.startsWith("avatars/") && !key.startsWith(`avatars/${session.user.id}/`)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const { client } = getStorageClient(null);
        const stream = await client.getObject(bucket, key);

        return new NextResponse(stream as any, {
            headers: {
                "Content-Type": "image/jpeg",
                "Cache-Control": "public, max-age=86400, immutable",
            },
        });
    } catch (err) {
        console.error("Raw media fetch failed", err);
        return new NextResponse("Not found", { status: 404 });
    }
}