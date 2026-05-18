import { db } from "@/db"
import { media } from "@/db/schema"
import {eq, desc, and, isNotNull } from "drizzle-orm";
import { auth } from "@/server/auth";
import TimelineGallery from "@/components/media/TimelineGallery";
import { year } from "drizzle-orm/singlestore-core";

export default async function ArchivePage() {
    const session = await auth();
    if (!session?.user?.id) return null;

    const items = await db.query.media.findMany({
        where: and(eq(media.ownerId, session.user.id), eq(media.isDeleted, false), eq(media.isArchived, true)),
        orderBy: [desc(media.dateTaken), desc(media.createdAt)],
    });

    const years = items.map(m => new Date(m.dateTaken || m.createdAt).getFullYear());
    const startYear = years.length > 0 ? Math.max(...years) : new Date().getFullYear();
    const endYear = years.length > 0 ? Math.min(...years) : startYear;

    return (
        <div>
            <div className="px-6 py-8 border-b border-neutral-900">
                <h1 className="text-2xl font-bold text-white">Archive</h1>
                <p className="text-sm text-neutral-500 mt-1">
                    {items.length} archived {items.length === 1 ? 'item' : 'items'}
                </p>
            </div>
            <TimelineGallery initialMedia={items as any} startYear={startYear} endYear={endYear} emptyMessage="Your archive is empty" / >
        </div>
    );
}