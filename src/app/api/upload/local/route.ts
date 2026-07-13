import { NextResponse } from 'next/server';
import { DiskClient } from '@/lib/storage';
import { auth } from '@/server/auth';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import path from 'path';
import fs from 'fs/promises';

export async function PUT(req:  Request) {
    const session = await auth();
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const bucket = searchParams.get("bucket");
    const key = searchParams.get("key");

    if (!bucket || !key) return new NextResponse("Missing params", { status: 400 });
    if (!key.startsWith(`users/${session.user.id}/`)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    const client = new DiskClient({});

    try{
        const destPath = client.getFullPath(bucket, key);
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        const writeStream = createWriteStream(destPath);

        if (req.body) {
            const readable = Readable.fromWeb(req.body as any);
            await new Promise((resolve, reject) => {
                readable.pipe(writeStream);
                readable.on('error', reject);
                writeStream.on('finish', () => resolve(null));
                writeStream.on('error', reject);
            });
        } else {
            return new NextResponse("Empty Body", { status: 400 });
        }
        return new NextResponse("OK", { status: 200 });
    } catch (err) {
        console.error("local upload stream failed", err);
        return new NextResponse("Error saving to file disk", { status: 500 });
    } 
}