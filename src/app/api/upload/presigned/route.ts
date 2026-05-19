import { NextResponse } from "next/server";
import { auth } from '@/server/auth';
import { minioClient, BUCKET_NAME } from "@/lib/storage";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401});

    try {
        const { filename, fileSize } = await req.json();
        const user = await db.query.users.findFirst({
            where: eq(users.id, session.user.id),
            columns: { storageUsed: true, storageQuota: true }
        });

        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const incomingMB = fileSize / (1024 * 1024);
        const usedMB = user.storageUsed || 0;
        const limitMB = user.storageQuota || 0;

        if (usedMB + incomingMB > limitMB) {
            return NextResponse.json({
                error: 'Storage quota exceeded', 
                message: `You need ${incomingMB.toFixed(2)}MB but only have ${(limitMB - usedMB).toFixed(2)}MB left`
            }, {status: 403 });
        }

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