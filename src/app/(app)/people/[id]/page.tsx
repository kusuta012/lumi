import { db } from "@/db";
import { eq, and, desc } from "drizzle-orm";
import { media, faces, people } from "@/db/schema";
import { auth } from "@/server/auth";
import { User } from "lucide-react";
import { redirect } from "next/navigation";
import TimelineGallery from "@/components/media/TimelineGallery";

export default async function PersonDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id: personId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/login");
    }

    const person = await db.query.people.findFirst({
        where: and(eq(people.id, personId), eq(people.ownerId, session.user.id)),
    });

    if (!person) {
        redirect("/people");
    }

    const dbMedia = await db.select({
        id: media.id,
        filename: media.filename,
        dateTaken: media.dateTaken,
        createdAt: media.createdAt,
        isFavorited: media.isFavorited,
        isArchived: media.isArchived,
        isDeleted: media.isDeleted,
        mimetype: media.mimetype,
        size: media.size,
        width: media.width,
        height: media.height
    })
    .from(media)
    .innerJoin(faces, eq(faces.mediaId, media.id))
    .where(and(
        eq(faces.personId, personId),
        eq(media.isDeleted, false),
        eq(media.isLocked, false)
    ))
    .orderBy(desc(media.dateTaken), desc(media.createdAt));
    const intialMedia = dbMedia.map(m => ({
        ...m,
        dateTaken: m.dateTaken ? new Date(m.dateTaken) : null,
        createdAt: new Date(m.createdAt),
    }))

    const years = intialMedia
        .map(m => new Date(m.dateTaken || m.createdAt).getFullYear())
        .filter(y => !isNaN(y));

    const startYear = years.length > 0 ? Math.min(...years) : new Date().getFullYear();
    const endYear = years.length > 0 ? Math.max(...years) : new Date().getFullYear();

    return (
        <div>
            <header className="p-8 pb-0 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-md sticky sticky top-0 z-20">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                        <User className="text-orange-500 w-6 h-6" /> {person.name}
                    </h1>
                    <p className="text-muted text-sm mt-2">
                        Showing {intialMedia.length} {intialMedia.length === 1 ? "photo" : "photos"} containing this face
                    </p>
                </div>
            </header>
            <TimelineGallery initialMedia={intialMedia} startYear={startYear} endYear={endYear} emptyMessage="No photos containing this person yet." />
        </div>
    );
}