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
    const jumpToYear = searchParams.get("jumpToYear");
    const jumpToMonth = searchParams.get("jumpToMonth");
    const limit = 50;

    try {
        const cursorId = searchParams.get("cursorId");
        let baseCondition = and(
            eq(media.ownerId, session.user.id),
            eq(media.isDeleted, false),
            eq(media.isArchived, false),
            eq(media.isLocked, false)
        );

        if (jumpToYear) {
            const month = jumpToMonth ? parseInt(jumpToMonth) : 12;
            const startMonth = jumpToMonth ? parseInt(jumpToMonth) : 1;
            const lastDay =  new Date(parseInt(jumpToYear), month, 0).getDate();
            const yearEnd = `${jumpToYear}-${String(month).padStart(2, '0')}-${lastDay}T23:59:59.999Z`;
            baseCondition = and(
                baseCondition,
                sql`COALESCE(${media.dateTaken}, ${media.createdAt}) <= ${yearEnd}::timestamp`
            );
        } else if (cursor && cursor !== "null") {
            baseCondition = and(
                baseCondition,
                sql`(COALESCE(${media.dateTaken}, ${media.createdAt}), ${media.id}) < (${cursor}::timestamp, ${cursorId}::uuid)`
            )
        }

        const photos = await db.query.media.findMany({
            where: baseCondition,
            orderBy: [
                sql`COALESCE(${media.dateTaken}, ${media.createdAt}) DESC`,
                desc(media.id)
            ],
            limit: limit,
        });

        let nextCursorTs = null;
        let nextCursorId = null;
        if (photos.length === limit) {
            const lastPhoto = photos[photos.length - 1];
            nextCursorTs = new Date(lastPhoto.dateTaken || lastPhoto.createdAt).toISOString();
            nextCursorId = lastPhoto.id;
        }

        return NextResponse.json({
            data: photos,
            nextCursorTs,
            nextCursorId
        });
    } catch (err) {
        return new NextResponse("failed to fetch timeline", { status: 500 });
    }
}