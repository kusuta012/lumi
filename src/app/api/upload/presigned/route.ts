import { NextResponse } from "next/server";
import { auth } from '@/server/auth';
import { minioClient, BUCKET_NAME } from "@/lib/storage";

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401});

    try {
        const { filename, contentType } = await req.json();
        const bucketExists = await minioClient.bucketExists(BUCKET_NAME);
        if (!bucketExists) await minioClient.makeBucket(BUCKET_NAME);

        const fileId = crypto.randomUUID();
        const objectKey = `users/${session.user.id}/${fileId}-${filename}`;
        const presignedUrl = await minioClient.presignedPutObject(BUCKET_NAME, objectKey, 3600);

        return NextResponse.json({ presignedUrl, objectKey })
    } catch (err) {
        console.error("presigned url error", err)
        return NextResponse.json({ error: 'Internal Server Error'}, { status: 500 });
    }
}