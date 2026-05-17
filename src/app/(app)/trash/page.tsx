import { db } from "@/db"
import { media } from "@/db/schema"
import {eq, desc, and, isNotNull } from "drizzle-orm";
import { auth } from "@/server/auth";
import TimelineGallery from "@/components/media/TimelineGallery";

export default async function TrashPage() {
    const session = await auth();
    if (!session?.user?.id) return null;

    const items = await db.query.media.findMany({
        where: and(eq(media.ownerId, session.user.id), eq(media.isDeleted, true)),
        orderBy: [desc(media.deletedAt)],
    });

    return (
        <div>
            <div className="px-6 py-8 border-b border-neutral-900">
                <h1 className="text-2xl font-bold text-white">Trash</h1>
                <p className="text-sm text-neutral-500 mt-1">Items here will be permanently deleted after 30 days</p>
            </div>
            <TimelineGallery initialMedia={items} startYear={2000} endYear={new Date().getFullYear()} / >
        </div>
    );
}