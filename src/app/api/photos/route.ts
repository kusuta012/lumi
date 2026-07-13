import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/db";
import { media } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const items = await db.query.media.findMany({
        where: and(
            eq(media.ownerId, session.user.id),
            eq(media.isDeleted, false)
        ),
        orderBy: [desc(media.dateTaken), desc(media.createdAt)],
    });
    return NextResponse.json(items);
}