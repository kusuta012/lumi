import { db } from "@/db"
import { media } from "@/db/schema"
import {eq, desc, and, isNotNull } from "drizzle-orm";
import { auth } from "@/server/auth";
import { Heart } from "lucide-react";
import TimelineGallery from "@/components/media/TimelineGallery";

export default async function FavoritesPage() {
    const session = await auth();
    if (!session?.user?.id) return null;

    const items = await db.query.media.findMany({
        where: and(eq(media.ownerId, session.user.id), eq(media.isDeleted, false), eq(media.isFavorited, true)),
        orderBy: [desc(media.dateTaken), desc(media.createdAt)],
    });

    const years = items.map(m => new Date(m.dateTaken || m.createdAt).getFullYear());
    const startYear = years.length > 0 ? Math.max(...years) : new Date().getFullYear();
    const endYear = years.length > 0 ? Math.min(...years) : startYear;

    return (
        <div>
            <div className="px-6 py-8 border-b border-neutral-900">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Heart className="text-orange-500 w-5 h-5"/>
                    Favorites
                </h1>
            </div>
            <TimelineGallery initialMedia={items as any} startYear={startYear} endYear={endYear} / >
        </div>
    );
}