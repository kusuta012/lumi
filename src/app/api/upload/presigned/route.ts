import { NextResponse } from "next/server";
import { auth } from '@/server/auth';
import { getStorageClient } from "@/lib/storage";
import { db } from "@/db";
import { users, storageBackends } from "@/db/schema";
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

        const defaultBackend = await db.query.storageBackends.findFirst({ 
            where: eq(storageBackends.isDefault, true) 
        });

        const { client, bucket } = getStorageClient(defaultBackend?.config);

        const bucketExists = await client.bucketExists(bucket);
        if (!bucketExists) await client.makeBucket(bucket);

        const fileId = crypto.randomUUID();
        const ext = filename.split(`.`).pop();
        const objectKey = `users/${session.user.id}/${fileId}-${ext}}`;
        const presignedUrl = await client.presignedPutObject(bucket, objectKey, 3600);

        return NextResponse.json({ presignedUrl, objectKey, backendId: defaultBackend?.id || null });
    } catch (err) {
        console.error("presigned url error", err)
        return NextResponse.json({ error: 'failed to generate presigned url'}, { status: 500 });
    }
}