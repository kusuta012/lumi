import * as chrono from 'chrono-node';
import { db } from "@/db";
import { media, faces, people, mediaTags, tags } from "@/db/schema";
import { eq, and, or, ilike, gte, lte, exists, inArray, sql, isNotNull, desc, SQL } from "drizzle-orm";
import { redisCache } from '@/lib/cache';
import { env } from "@/lib/env";
import { endOfWeek } from 'date-fns';

export interface ParsedQuery {
    startDate: Date | null;
    endDate: Date | null;
    personIds: string[];
    locations: string[];
    semanticText: string;
}

export class HybridSearchEngine {
    private static async getUserDictionary(userId: string) {
        const cacheKey = `user_search_dict:${userId}`;
        const cached = await redisCache.get(cacheKey);
        if (cached) return cached as { people: Record<string, string>, locations: string[] };

        const userPeople = await db.query.people.findMany({
            where: and(eq(people.ownerId, userId), eq(people.isHidden, false)),
            columns: { id: true, name: true }
        });

        const peopleDict: Record<string, string> = {};
        userPeople.forEach(p => {
            if (p.name.toLowerCase() !== "unknown person") {
                peopleDict[p.name.toLowerCase()] = p.id;
            }
        });
        
        const locResult = await db.execute(sql`
            SELECT DISTINCT location_city as city, location_country as country
            FROM ${media}
            WHERE owner_id = ${userId}::uuid AND is_deleted = false
        `);

        const locs = new Set<string>();
        for (const row of locResult as any[]) {
            if (row.city) locs.add(row.city.toLowerCase());
            if (row.country) locs.add(row.country.toLowerCase());
        }

        const dict = { people: peopleDict, locations: Array.from(locs) };
        await redisCache.set(cacheKey, dict, 3600);
        return dict;
    }

    public static async parseQuery(userId: string, rawQuery: string): Promise<ParsedQuery> {
        let text = rawQuery.toLowerCase();
        const dict = await this.getUserDictionary(userId);

        const result: ParsedQuery = {
            startDate: null, endDate: null, personIds: [], locations: [], semanticText: ""
        };

        const dateResults = chrono.parse(text);
        if (dateResults.length > 0) {
            const dateStr = dateResults[0];
            result.startDate = dateStr.start.date();
            result.endDate = dateStr.end ? dateStr.end.date() : null;

            if (!dateStr.end) {
                if (!dateStr.start.isCertain('month')) {
                    result.endDate = new Date(result.startDate.getFullYear(), 11, 31, 23, 59, 59);
                } else if (!dateStr.start.isCertain('day')) {
                    result.endDate = new Date(result.startDate.getFullYear(), result.startDate.getMonth() + 1, 0, 23, 59, 59);
                } else {
                    result.endDate = new Date(result.startDate.getFullYear(), result.startDate.getMonth(), result.startDate.getDate(), 23, 59, 59);
                }
            }
            text = text.replace(dateStr.text.toLowerCase(), "");
        }
        for (const [name, id] of Object.entries(dict.people)) {
            if (text.includes(name)) {
                result.personIds.push(id);
                text = text.replace(new RegExp(`\\b${name}\\b`, 'gi'), "");
            }
        }

        for (const loc of dict.locations) {
            if (text.includes(loc)) {
                result.locations.push(loc);
                text = text.replace(new RegExp(`\\b${loc}\\b`, 'gi'), "");
            }
        }

        const stopWordds = ["photos of", "pictures of", "video of", "show me", "in", "at", "on", "the", "a", "an"];
        for (const word of stopWordds) {
            text = text.replace(new RegExp(`\\b${word}\\b`, 'gi'), "");
        }

        result.semanticText = text.replace(/\s+/g, ' ').trim();
        return result;
    }

    public static async execute(userId: string, rawQuery: string) {
        const parsed = await this.parseQuery(userId, rawQuery);
        const conditions: (SQL | undefined)[] = [
            eq(media.ownerId, userId),
            sql`${media.isDeleted} IS NOT TRUE`,
            sql`${media.isLocked} IS NOT TRUE`
        ];

        if (parsed.startDate && parsed.endDate) {
            conditions.push(gte(media.dateTaken, parsed.startDate));
            conditions.push(lte(media.dateTaken, parsed.endDate));
        }

        if (parsed.locations.length > 0) {
            const locConditions = parsed.locations.flatMap(loc => [
                ilike(media.locationCity, `%${loc}%`),
                ilike(media.locationCountry, `%%${loc}`)
            ]);
            conditions.push(or(...locConditions));
        }

        if (parsed.personIds.length > 0) {
            conditions.push(exists(
                db.select({ id: faces.id })
                    .from(faces)
                    .where(and(
                        eq(faces.mediaId, media.id),
                        inArray(faces.personId, parsed.personIds)
                    ))
            ));
        }

        let orderByClause = [desc(media.dateTaken), desc(media.createdAt)];

        if (parsed.semanticText.length > 2) {
            const mlRes = await fetch(`${env.ML_API_URl}/encode/text`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: parsed.semanticText })
            });

            if (mlRes.ok) {
                const { embedding } = await mlRes.json();
                const embeddingStr = `[${embedding.join(',')}]`;

                conditions.push(isNotNull(media.clipEmbedding));
                conditions.push(or(
                    sql`${media.clipEmbedding} <=> ${embeddingStr}::vector < 0.75`,
                    exists(
                        db.select({ id: mediaTags.tagId })
                            .from(mediaTags)
                            .innerJoin(tags, eq(mediaTags.tagId, tags.id))
                            .where(and(
                                eq(mediaTags.mediaId, media.id),
                                ilike(tags.name, `%${parsed.semanticText}%`)
                            ))
                    )
                ));
                orderByClause = [sql`${media.clipEmbedding} <=> ${embeddingStr}::vector ASC` as any];
            }
        }
        const activeConditions = conditions.filter(Boolean) as SQL[];
        const results = await db.query.media.findMany({
            where: activeConditions.length > 0 ? and(...activeConditions) : undefined,
            orderBy: orderByClause,
            limit: 50
        });

        return { results, parsed };
    }
}