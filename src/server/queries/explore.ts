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
        LEFT JOIN ${faces} f ON f.person_id = p.id
        WHERE p.owner_id = ${userId}::uuid AND p.is_hidden = false
        GROUP BY p.id, p.name, p.cover_face_id
        HAVING count(f.id) > 0
        ORDER BY "faceCount" DESC
        LIMIT 8
        `);
    
    const peopleRows = (result as any) as TopPerson[];
    await redisCache.set(cacheKey, peopleRows, 3600)
    return peopleRows;
}

export async function getRcntHighlights(userId: string): Promise<HighlightItem[]> {
    const cacheKey = `user_explore_highlight:${userId}`;
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

    const results = await db.query.media.findMany({
        where: and(
            eq(media.ownerId, userId),
            eq(media.isDeleted, false),
            eq(media.isLocked, false),
            isNotNull(media.blurScore),
            gt(media.createdAt, thirtyDaysAgooo)
        ),
        orderBy: [desc(media.blurScore)],
        limit: 20
    });

    const serializable = results.map(r => ({
        id: r.id,
        filename: r.filename,
        mimetype: r.mimetype,
        size: r.size,
        width: r.width,
        height: r.height,
        createdAt: r.createdAt.toISOString(),
        dateTaken: r.dateTaken ? r.dateTaken.toISOString() : null,
        blurScore: r.blurScore
    }));
    await redisCache.set(cacheKey, serializable, 3600);
    return results as unknown as HighlightItem[];
}