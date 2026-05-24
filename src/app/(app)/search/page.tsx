import { db } from "@/db";
import { media } from "@/db/schema";
import { eq, desc, and , or, ilike} from "drizzle-orm";
import { auth } from "@/server/auth"
import TimelineGallery from "@/components/media/TimelineGallery";

export default async function SearchPage({
    searchParams
}: {
    searchParams: Promise<{ q: string}>
}) {
    const session = await auth();
    if (!session?.user?.id) return null;

    const params = await searchParams;
    const query = params.q || "";
    const results = await db.query.media.findMany({
        where: and(
            eq(media.ownerId, session.user.id),
            eq(media.isDeleted, false),
            or(
                ilike(media.filename, `%${query}%`),
                ilike(media.cameraModel, `%${query}%`)
            )
        ),
        orderBy: [desc(media.dateTaken), desc(media.createdAt)],
    });

    const years = results.map(m => new Date(m.dateTaken || m.createdAt).getFullYear());
    const startYear = years.length > 0 ? Math.max(...years) : new Date().getFullYear();
    const endYear = years.length > 0 ? Math.min(...years) : startYear;

    return (
        <div>
            <div className="px-6 py-8 border-b border-border">
                <h1 className="text-2xl font-bold text-foreground">Search Results</h1>
                <p className="text-muted text-sm mt-1">
                    Found {results.length} results for <span className="text-foreground-400">{query}</span>
                </p>
            </div>

            <TimelineGallery initialMedia={results as any} startYear={startYear} endYear={endYear} />
        </div>
    );
}