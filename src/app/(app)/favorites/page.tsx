import { db } from "@/db"
import { media } from "@/db/schema"
import {eq, desc, and, isNotNull } from "drizzle-orm";
import { auth } from "@/server/auth";
import TimelineGallery from "@/components/media/TimelineGallery";

export default async function FavoritesPage() {
    const session = await auth();
    if (!session?.user?.id) return null;

    const items = await db.query.media.findMany({
        where: and(eq(media.ownerId, session.user.id), eq(media.isDeleted, false), eq(media.isFavorited, true)),
        orderBy: [desc(media.dateTaken), desc(media.createdAt)],
    });

    return (
        <div>
            <div className="px-6 py-8 border-b border-neutral-900">
                <h1 className="text-2xl font-bold text-white">Favorites</h1>
            </div>
            <TimelineGallery initialMedia={items} startYear={2000} endYear={new Date().getFullYear()} / >
        </div>
    );
}