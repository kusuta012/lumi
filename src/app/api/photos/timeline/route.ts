import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/db";
import { media } from "@/db/schema";
import { eq, desc, and, lt, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
    const session = await auth();
    if(!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor");
    const limit = 50;

    try {
        let baseCondition = and(
            eq(media.ownerId, session.user.id),
            eq(media.isDeleted, false),
            eq(media.isArchived, false),
            eq(media.isLocked, false)
        );

        if (cursor && cursor !== "null") {
            const cursorDate = new Date(cursor);
            baseCondition = and(
                baseCondition,
                sql`COALESCE(${media.dateTaken}, ${media.createdAt}) < ${cursor}::timestamp`
            );
        }

        const photos = await db.query.media.findMany({
            where: baseCondition,
            orderBy: [desc(media.dateTaken), desc(media.createdAt)],
            limit: limit,
        });

        let nextCursor = null;
        if (photos.length === limit) {
            const lastPhoto = photos[photos.length - 1];
            nextCursor = new Date(lastPhoto.dateTaken || lastPhoto.createdAt).toISOString();
        }

        return NextResponse.json({
            data: photos,
            nextCursor: nextCursor
        });
    } catch (err) {
        return new NextResponse("failed to fetch timeline", { status: 500 });
    }
}