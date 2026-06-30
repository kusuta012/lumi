import { db } from "@/db";
import { media, faces, people } from "@/db/schema";
import { eq, and, desc, sql, gt, isNotNull } from "drizzle-orm";
import { redisCache } from "@/lib/cache";

export interface TopPerson {
    id: string;
    name: string;
    coverFaceId: string | null;
    faceCount: number;
}

export interface HighlightItem {
    id: string;
    filename: string;
    mimetype: string;
    size: string;
    width: number | null;
    height: number | null;
    createdAt: string;
    dateTaken: string | null;
    blurScore: number | null;
    aestheticScore: number | null;
}

export interface PlaceHighlight {
    city: string;
    country: string;
    mediaCount: number;
    coverMediaId: string;
}

export async function getTopPeople(userId: string): Promise<TopPerson[]> {
    const cacheKey = `user_explore_people:${userId}`;
    const cachedData = await redisCache.get(cacheKey);

    if (cachedData) {
        return cachedData as TopPerson[];
    }

    const result = await db.execute(sql`
        SELECT p.id, p.name, p.cover_face_id as "coverFaceId", count(f.id)::int as "faceCount"
        FROM ${people} p
        INNER JOIN ${faces} f ON f.person_id = p.id
        INNER JOIN media m ON f.media_id = m.id
        WHERE p.owner_id = ${userId}::uuid 
            AND p.is_hidden = false
            AND m.is_deleted = false
            AND m.is_locked = false
        GROUP BY p.id, p.name, p.cover_face_id
        ORDER BY "faceCount" DESC
        LIMIT 8
        `);
    
    const peopleRows = (result as any) as TopPerson[];
    await redisCache.set(cacheKey, peopleRows, 3600)
    return peopleRows;
}

export async function getRcntHighlights(userId: string): Promise<HighlightItem[]> {
    const today = new Date().toISOString().split("T")[0];
    const cacheKey = `user_explore_highlight:${userId}:${today}`;
    const cachedData = await redisCache.get(cacheKey);

    if (cachedData) {
        return (cachedData as any[]).map(item => ({
            ...item,
            createdAt: new Date(item.createdAt),
            dateTaken: item.dateTaken ? new Date(item.dateTaken) : null
        })) as unknown as HighlightItem[];
    }

    const thirtyDaysAgooo = new Date();
    thirtyDaysAgooo.setDate(thirtyDaysAgooo.getDate() - 30);

    let results = await db.query.media.findMany({
        where: and(
            eq(media.ownerId, userId),
            eq(media.isDeleted, false),
            eq(media.isLocked, false),
            isNotNull(media.aestheticScore),
            gt(media.aestheticScore, 50),
            gt(media.createdAt, thirtyDaysAgooo)
        ),
        orderBy: [desc(media.aestheticScore)],
        limit: 40
    });

    if (results.length < 5) {
        results = await db.query.media.findMany({
            where: and(
                eq(media.ownerId, userId),
                eq(media.isDeleted, false),
                eq(media.isLocked, false),
                isNotNull(media.blurScore),
                gt(media.createdAt, thirtyDaysAgooo)
            ),
            orderBy: [desc(media.blurScore)],
            limit: 40
        })
    }

    for (let i = results.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [results[i], results[j]] = [results[j], results[i]];
    }

    const picked = results.slice(0, 20);

    const serializable = results.map(r => ({
        id: r.id,
        filename: r.filename,
        mimetype: r.mimetype,
        size: r.size,
        width: r.width,
        height: r.height,
        createdAt: r.createdAt.toISOString(),
        dateTaken: r.dateTaken ? r.dateTaken.toISOString() : null,
        blurScore: r.blurScore,
        aestheticScore: r.aestheticScore
    }));

    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const secsUntilMidnight = Math.floor((midnight.getTime() - now.getTime()) / 1000);

    await redisCache.set(cacheKey, serializable, secsUntilMidnight);
    return picked as unknown as HighlightItem[];
}

export async function getTopPlaces(userId: string): Promise<PlaceHighlight[]> {
    const cacheKey = `user_explore_places:${userId}`;
    const cachedData = await redisCache.get(cacheKey);

    if (cachedData) return cachedData as PlaceHighlight[];
    const result = await db.select({
        city: media.locationCity,
        country: media.locationCountry,
        mediaCount: sql<number>`count(${media.id})::int`,
        coverMediaId: sql<string>`(array_agg(${media.id} ORDER BY ${media.createdAt} DESC))[1]`
    })
    .from(media)
    .where(and(
        eq(media.ownerId, userId),
        eq(media.isDeleted, false),
        eq(media.isLocked, false),
        isNotNull(media.locationCity)
    ))
    .groupBy(media.locationCity, media.locationCountry)
    .orderBy(desc(sql`count(${media.id})`))
    .limit(8);

    const places = (result as any) as PlaceHighlight[];
    await redisCache.set(cacheKey, places, 3600);
    return places;
}

export async function getMemories(userId: string): Promise<HighlightItem[]> {
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();
    const results = await db.execute(sql`
       SELECT id, filename, mimetype, size, width, height,
            created_at as "createdAt", date_taken as "dateTaken",
            blur_score as "blurScore", aesthetic_score as "aestheticScore"
       FROM media
       WHERE owner_id = ${userId}::uuid
         AND is_deleted = false
         AND is_locked = false
         AND date_taken IS NOT NULL
         AND EXTRACT(MONTH FROM date_taken) = ${todayMonth}
         AND EXTRACT(DAY FROM date_taken) = ${todayDay}
         AND EXTRACT(YEAR FROM date_taken) < ${today.getFullYear()}
         AND (aesthetic_score > 40 OR blur_score > 60)
       ORDER BY aesthetic_score DESC NULLS LAST, blur_score DESC NULLS LAST
       LIMIT 20 
    `);

    return (results as any[]) as HighlightItem[];
}