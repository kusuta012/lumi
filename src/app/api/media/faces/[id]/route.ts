import { db } from "@/db";
import { faces } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getStorageClient } from "@/lib/storage";
import { NextResponse } from "next/server";
import sharp from "sharp";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const face = await db.query.faces.findFirst({
            where: eq(faces.id, id),
            with: {
                media: {
                    with: {
                        storageBackend: true
                    }
                }
            }
        });

        if (!face || !face.media) {
            return new Response("Face record not found", { status: 404 });
        }

        const { client, bucket } = getStorageClient(face.media.storageBackend?.config);
        const stream = await client.getObject(bucket, face.media.objectKey);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        }
        const originalBuffer = Buffer.concat(chunks);
        const box = face.boundingBox as { x: number; y: number; w: number; h: number };
        const imgWidth = face.media.width || 0;
        const imgHeight = face.media.height || 0;

        let left = Math.max(0, Math.round(box.x));
        let top = Math.max(0, Math.round(box.y));
        let width = Math.max(1, Math.round(box.w));
        let height = Math.max(1, Math.round(box.h));

        if (imgWidth && imgHeight) {
            if (left >= imgWidth) left = 0;
            if (top >= imgHeight) top = 0;
            if (left + width > imgWidth) width = imgWidth - left;
            if (top + height > imgHeight) height = imgHeight - top;
        }

        const faceAvatar = await sharp(originalBuffer)
            .extract({ left, top, width, height })
            .resize(200, 200, { fit: "cover" })
            .webp({ quality: 85 })
            .toBuffer();

        return new NextResponse(new Uint8Array(faceAvatar), {
            headers: {
                "Content-Type": "image/webp",
                "Cache-Control": "public, max-age=31535000, immutable"
            }
        });
    } catch (err) {
        console.error("Failed tp generate custom face crop", err);
        return new Response("failed to generate custom face crop", { status: 500 });
    }
}