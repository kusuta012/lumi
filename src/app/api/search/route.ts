import { db } from "@/db";
import { media } from "@/db/schema";
import { sql, and, eq, ilike } from "drizzle-orm";
import { env } from "@/lib/env";
import { NextResponse } from "next/server";
import { auth } from "@/server/auth"

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const  userId = session.user.id

    try {
        const body = await req.json();
        const { searchQuery, mode = "context" } = body;

        if (!searchQuery) {
            return NextResponse.json({ error: "Missing searchQuery" }, { status: 400 });
        }

        let results = [];

        if (mode === "context") {
            const response = await fetch (`${env.ML_API_URl}/encode/text`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: searchQuery })
            });
    
            if (!response.ok) {
                return NextResponse.json({ error: "ML container is offline" }, { status: 500 });
            }
    
            const { embedding } = await response.json();
            const embeddingStr = `[${embedding.join(',')}]`;
            results = await db.query.media.findMany({
                where: and(
                    eq(media.ownerId, userId),
                    eq(media.isDeleted, false),
                    eq(media.isLocked, false)
                ),
                orderBy: sql`${media.clipEmbedding} <=> ${embeddingStr}::vector ASC`,
                limit: 50
            });
        }

        else if (mode === "filename") {
            results = await db.query.media.findMany({
                where: and(
                    eq(media.ownerId, userId),
                    eq(media.isDeleted, false),
                    eq(media.isLocked, false),
                    ilike(media.filename, `%${searchQuery}%`)
                ),
                orderBy: sql`${media.createdAt} DESC`,
                limit: 50
            });
        }

        else if (mode === "ocr") {
            results = await db.query.media.findMany({
                where: and(
                    eq(media.ownerId, userId),
                    eq(media.isDeleted, false),
                    eq(media.isLocked, false),
                    ilike(media.extractedText, `%${searchQuery}%`)
                ),
                orderBy: sql`${media.createdAt} DESC`,
                limit: 50
            });
        }

        else {
            return NextResponse.json({ error: "Invalid search mode" }, { status: 400 });
        }

        return NextResponse.json({ results });
    } catch (err) {
        console.error("Search api error", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}