import { db } from "@/db";
import { media } from "@/db/schema";
import { eq, desc, and , or, ilike, sql, isNotNull} from "drizzle-orm";
import { auth } from "@/server/auth";
import TimelineGallery from "@/components/media/TimelineGallery";
import { env } from "@/lib/env";

export default async function SearchPage({
    searchParams
}: {
    searchParams: Promise<{ q: string, mode?: string }>
}) {
    const session = await auth();
    if (!session?.user?.id) return null;

    const params = await searchParams;
    const query = params.q || "";
    const mode = params.mode || "context";

    let results: any[] = [];

    if (query.trim()) {
        if (mode === "context") {
            try {
                const mlRes = await fetch(`${env.ML_API_URl}/encode/text`, {
                    method: "POST",
                    headers: { "Accept": "application/json",
                             "Content-Type": "application/json" },
                    body: JSON.stringify({ text: query })
                });

                if (mlRes.ok) {
                    const { embedding } = await mlRes.json();
                    const embeddingStr = `[${embedding.join(`,`)}]`;

                    results = await db.query.media.findMany({
                        where: and(
                            eq(media.ownerId, session.user.id),
                            eq(media.isDeleted, false),
                            eq(media.isLocked, false),
                            isNotNull(media.clipEmbedding),
                            sql`${media.clipEmbedding} <=> ${embeddingStr}::vector < 0.77`
                        ),
                        orderBy: sql`${media.clipEmbedding} <=> ${embeddingStr}::vector ASC`,
                        limit: 50
                    });
                console.log(`Context search completed. Found ${results.length} matches.`);
                }
            } catch (err) {
                console.error("Context Search failed to reach ML API", err);
            }
        }
        else if (mode === "ocr") {
            const tokens = query.trim().split(/\s+/).filter(Boolean);
            const ocrConds = tokens.map(token => ilike(media.extractedText, `%${token}%`));  
            results = await db.query.media.findMany({
                where: and(
                    eq(media.ownerId, session.user.id),
                    eq(media.isDeleted, false),
                    eq(media.isLocked, false),
                    isNotNull(media.extractedText),
                    and(...ocrConds)
                ),
                orderBy: [desc(media.dateTaken), desc(media.createdAt)],
                limit: 50
            });
        }
        else {
            results = await db.query.media.findMany({
                where: and(
                    eq(media.ownerId, session.user.id),
                    eq(media.isDeleted, false),
                    eq(media.isLocked, false),
                    or(
                        ilike(media.filename, `%${query}%`),
                        ilike(media.cameraModel, `%${query}%`),
                        ilike(media.locationCity, `%${query}%`),
                        ilike(media.locationState, `%${query}%`),
                        ilike(media.locationCountry, `%${query}%`),
                    )
                ),
                orderBy: [desc(media.dateTaken), desc(media.createdAt)],
                limit: 50
            });
        }
    }

    const uniqueMedia = results.filter((value, index, self) =>
        self.findIndex(m => m.id === value.id) === index
    );

    const years = uniqueMedia.map(m => new Date(m.dateTaken || m.createdAt).getFullYear());
    const startYear = years.length > 0 ? Math.max(...years) : new Date().getFullYear();
    const endYear = years.length > 0 ? Math.min(...years) : startYear;

    return (
        <div>
            <div className="px-6 py-8 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-20">
                <h1 className="text-2xl font-bold text-foreground">Search Results</h1>
                <p className="text-muted text-sm mt-1">
                    Found {results.length} results for <span className="text-foreground-400 font-semibold">{query}</span>
                </p>
                <div className="mt-2 text-[10px] font-semibold text-muted tracking-wider">
                    Mode: {mode === "ocr" ? "Text in Image (OCR)" : mode === "filename" ? "Filename & metadata" : "Semantic Search"}
                </div>
            </div>

            {results.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-muted">
                    <p className="text-lg font-medium">No results found</p>
                    <p className="text-sm">Try using a diffrent search mode</p>
                </div>
            ) : (
                <TimelineGallery initialMedia={results as any} startYear={startYear} endYear={endYear} isSearchPage={true} />
            )}
        </div>
    );
}