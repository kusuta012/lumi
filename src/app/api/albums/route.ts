import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/db";
import { albums } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userAlbums = await db.query.albums.findMany({
        where: eq(albums.ownerId, session.user.id),
        orderBy: [desc(albums.createdAt)],
    });
    return NextResponse.json(userAlbums);
}