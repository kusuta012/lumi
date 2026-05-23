import { db } from "@/db"
import { media } from "@/db/schema"
import {eq, desc, and, isNotNull } from "drizzle-orm";
import { auth } from "@/server/auth";
import TimelineGallery from "@/components/media/TimelineGallery";
import { redisCache } from "@/lib/cache";

export default async function PhotosPage() {
    const session = await auth();
    if (!session?.user?.id) return null;
    const cacheKey = `user_photos_timeline:${session.user.id}`;
    let userMedia = await redisCache.get(cacheKey);
    if (!userMedia) {
        console.log("cache miss , fetching..");
        userMedia = await db.query.media.findMany({
            where: and(
                eq(media.ownerId, session.user.id),
                eq(media.isDeleted, false),
                eq(media.isArchived, false),
                eq(media.isLocked, false)
            ),
            orderBy: [desc(media.dateTaken), desc(media.createdAt)],
        });
        await redisCache.set(cacheKey, userMedia, 3600);
    } else {
        console.log("cache hit!");
        userMedia = userMedia.map((m: any) => ({
            ...m,
            dateTaken: m.dateTaken ? new Date(m.dateTaken) : null,
            createdAt: new Date(m.createdAt),
        }));
    }

    const years = userMedia.map((m: any) => new Date(m.dateTaken || m.createdAt).getFullYear());    
    const startYear = years.length > 0 ? years[0] : new Date().getFullYear();
    const endYear = years.length > 0 ? years[years.length -1] : startYear;

    return (
        <TimelineGallery initialMedia={userMedia} startYear={startYear} endYear={endYear} />
    );
}