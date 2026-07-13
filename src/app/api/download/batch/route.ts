import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/db";
import { media } from "@/db/schema";
import { inArray, and, eq } from "drizzle-orm";
import { getStorageClient } from "@/lib/storage";
import { redisCache } from "@/lib/cache";
import yazl from "yazl";
import { PassThrough } from "stream";
import { randomUUID } from "crypto";
import { isFlipperEnabled } from "@/lib/flippers";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const downloadsEnabled = await isFlipperEnabled("downloads_enabled");
    if (!downloadsEnabled) return new NextResponse("Downloads are temporarily disabled by administrator", { status: 403 });

    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
        return new NextResponse("Invalid Request", { status: 400 });
    }

    const token = randomUUID();
    await redisCache.set(`batch_download:${token}`, JSON.stringify(ids), 300);
    return NextResponse.json({ url: `/api/download/batch?token=${token}` });
}

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const downloadsEnabled = await isFlipperEnabled("downloads_enabled");
    if (!downloadsEnabled) return new NextResponse("Downloads are temporarily disabled by administrator", { status: 403 });

    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) return new NextResponse("token missing", { status: 400 });

    const idsStr = await redisCache.get(`batch_download:${token}`);
    if (!idsStr) return new NextResponse("Token expired or invalid", { status: 404 });
    
    let ids: string[];
    try {
        ids = typeof idsStr === "string" ? JSON.parse(idsStr) : idsStr;
    } catch {
        return new NextResponse("Invalid token data", { status: 500 });
    }

    const items = await db.query.media.findMany({
        where: and(inArray(media.id, ids), eq(media.ownerId, session.user.id)),
        with: { storageBackend: true }
    });

    if (items.length === 0) {
        return new NextResponse("No accessible media found", { status: 404 });
    }

    const archive = new yazl.ZipFile();
    const passThrough = new PassThrough();

    archive.outputStream.pipe(passThrough);

    (async () => {
        const fileNames = new Set<string>();

        for (const item of items) {
            try {
                const { client, bucket } = getStorageClient(item.storageBackend?.config, item.storageBackendId);
                const fileStream = await client.getObject(bucket, item.objectKey);
                
                let name = item.filename;
                let counter = 1;
                while (fileNames.has(name)) {
                    const parts = item.filename.split('.');
                    const ext = parts.pop();
                    const base = parts.join('.');
                    name = `${base}_${counter}.${ext}`;
                    counter++;
                }
                fileNames.add(name);
                archive.addReadStream(fileStream as any, name);
            } catch (err) {
                console.error(`Failed to add ${item.filename} to zip`, err);
            }
        }
        archive.end();
    })();

    const readable = new ReadableStream({
        start(controller) {
            passThrough.on("data", (chunk) => controller.enqueue(new Uint8Array(chunk)));
            passThrough.on("end", () => controller.close());
            passThrough.on("error", (err) => controller.error(err));
        },
        cancel() {
            (archive.outputStream as any).destroy();
            passThrough.destroy();
        }
    });

    return new NextResponse(readable, {
        headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="lumi-batch-${new Date().toISOString().split('T')[0]}.zip"`
        }
    });
}