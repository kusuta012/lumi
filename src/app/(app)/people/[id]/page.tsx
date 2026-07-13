import { db } from "@/db";
import { eq, and, desc, exists, sql } from "drizzle-orm";
import { media, faces, people } from "@/db/schema";
import { auth } from "@/server/auth";
import { User } from "lucide-react";
import { redirect } from "next/navigation";
import TimelineGallery from "@/components/media/TimelineGallery";
import PersonHeader from "@/components/people/PersonHeader";

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
    .where(and(
        eq(media.ownerId, session.user.id),
        eq(media.isDeleted, false),
        eq(media.isLocked, false),
        exists(
            db.select({ id: faces.id })
                .from(faces)
                .where(and(
                    eq(faces.mediaId, media.id),
                    eq(faces.personId, personId)
                ))
        )
    ))
    .orderBy(
        sql`COALESCE(${media.dateTaken}, ${media.createdAt}) DESC`,
        desc(media.id)
    );

    const uniqueMedia = dbMedia.filter((value, index, self) =>
        self.findIndex(m => m.id === value.id) === index
    );

    const intialMedia = uniqueMedia.map(m => ({
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
            <PersonHeader
                person={{ id: person.id, name: person.name, coverFaceId: person.coverFaceId }}
                photoCount={intialMedia.length}
            />
            <TimelineGallery initialMedia={intialMedia} startYear={startYear} endYear={endYear} emptyMessage="No photos containing this person yet." />
        </div>
    );
}