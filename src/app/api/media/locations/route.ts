import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/db";
import { media } from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { redisCache } from "@/lib/cache";

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
    const cacheKey = `user_locations:${session.user.id}`;
    let locatedPhotos = await redisCache.get(cacheKey);
    
    if (!locatedPhotos) {
        console.log("cache miss , locations .. fetching")
        const locatedPhotos = await db.query.media.findMany({
            where: and(
                eq(media.ownerId, session.user.id),
                eq(media.isDeleted, false),
                eq(media.isLocked, false),
                isNotNull(media.gpsLat),
                isNotNull(media.gpsLng)
            )
        });

        await redisCache.set(cacheKey, locatedPhotos, 21600);
    } else {
        console.log("cache hit, locations");
    }
    return NextResponse.json(locatedPhotos);
}