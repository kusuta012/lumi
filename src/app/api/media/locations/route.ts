import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/db";
import { media } from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
    try {
        const locatedPhotos = await db.query.media.findMany({
            where: and(
                eq(media.ownerId, session.user.id),
                eq(media.isDeleted, false),
                eq(media.isLocked, false),
                isNotNull(media.gpsLat),
                isNotNull(media.gpsLng)
            )
        });

        return NextResponse.json(locatedPhotos);
    } catch (err) {
        console.error("Failed to fetch map data", err);
        return new NextResponse("Internal Server eror", { status: 500 });
    }
}