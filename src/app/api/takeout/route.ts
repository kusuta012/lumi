import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { getStorageClient } from "@/lib/storage";
import { db } from "@/db";
import { storageBackends } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
    const session = await auth();
    if(!session?.user?.id) return new NextResponse("Unauthorized", { status: 404});

    const { searchParams } = new URL(req.url);
    const fileKey = searchParams.get("file");
    if (!fileKey) return new NextResponse("Missing file", { status: 400 });
    
    if (!fileKey.startsWith(`backups/${session.user.id}/`)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const defaultBackend = await db.query.storageBackends.findFirst({
            where: eq(storageBackends.isDefault, true)
        });
        const { client, bucket } = getStorageClient(defaultBackend?.config);
        const dataStream = await client.getObject(bucket, fileKey);
        return new NextResponse(dataStream as any, {
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="lumi-takeout.zip"`
            }
        });
    } catch (err) {
        return new NextResponse("Error downloading takeout archive", { status: 500 });
    }
}