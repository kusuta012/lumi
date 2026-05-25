import { db } from "@/db";
import { media } from "@/db/schema";
import { sql, and, eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { searchQuery, userId } = body;

        if (!searchQuery || !userId ) {
            return NextResponse.json({ error: "Missing searchQuery or UserId" }, { status: 400 });
        }

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
        const results = await db.query.media.findMany({
            where: and(
                eq(media.ownerId, userId),
                eq(media.isDeleted, false),
                eq(media.isLocked, false)
            ),
            orderBy: sql`${media.clipEmbedding} <=> ${embeddingStr}::vector ASC`,
            limit: 30
        });

        return NextResponse.json({ results });
    } catch (err) {
        console.error("Search api error", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}