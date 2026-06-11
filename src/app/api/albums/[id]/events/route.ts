import { NextRequest } from "next/server";
import IORedis from "ioredis";
import { env } from "@/lib/env";
import { auth } from "@/server/auth";
import { db } from "@/db";
import { albums, albumContributors } from "@/db/schema";
import { eq, and , or } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

    const { id: albumId } = await params;

    const albumAccess = await db.select({ id: albums.id })
        .from(albums)
        .leftJoin(albumContributors, eq(albumContributors.albumId, albums.id))
        .where(and(
            eq(albums.id, albumId),
            or(
                eq(albums.ownerId, session.user.id),
                eq(albumContributors.userId, session.user.id)
            )
        ));
    
    if (albumAccess.length === 0) return new Response("Forbidden", { status: 403 });
    
    const stream = new ReadableStream({
        start(controller) {
            const subscriber = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

            subscriber.subscribe(`album:${albumId}`);

            subscriber.on("message", (channel, message) => {
                if (channel === `album:${albumId}`) {
                    controller.enqueue(`data: ${message}\n\n`);
                }
            });

            const keepAlive = setInterval(() => {
                controller.enqueue(`: keepalive\n\n`);
            }, 30000);

            req.signal.addEventListener("abort", () => {
                clearInterval(keepAlive);
                subscriber.quit();
            });
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
        }
    });
}