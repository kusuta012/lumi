import { db } from "@/db"
import { media } from "@/db/schema"
import {eq, desc, and, isNotNull } from "drizzle-orm";
import { auth } from "@/server/auth";
import TimelineGallery from "@/components/media/TimelineGallery";

export default async function PhotosPage() {
    const session = await auth();
    if (!session?.user?.id) return null;

    const userMedia = await db.query.media.findMany({
        where: and(
            eq(media.ownerId, session.user.id),
            eq(media.isDeleted, false),
            eq(media.isArchived, false)
        ),
        orderBy: [desc(media.dateTaken), desc(media.createdAt)],
    });

    const years = userMedia
        .map(m => new Date(m.dateTaken || m.createdAt).getFullYear())
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort((a, b) => b - a);
    
    const startYear = years.length > 0 ? years[0] : new Date().getFullYear();
    const endYear = years.length > 0 ? years[years.length -1] : startYear;

    return (
        <TimelineGallery initialMedia={userMedia} startYear={startYear} endYear={endYear} />
    );
}