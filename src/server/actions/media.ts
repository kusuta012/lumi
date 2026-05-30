"use server";

import { db } from "@/db";
import { media, users } from "@/db/schema";
import { auth } from "@/server/auth";
import { revalidatePath } from "next/cache";
import { addMediaToPipe } from "@/lib/queue"
import { eq, sql } from "drizzle-orm"
import { redisCache } from "@/lib/cache";
 
export async function recordMediaUpload(data: {
    filename: string;
    mimetype: string;
    size: number;
    objectKey: string;
    storageBackendId: string | null;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    
    try {
        const sizeInMB = data.size > 0 ? Math.max(1, Math.round(data.size / (1024 * 1024))) : 0;
        await db.transaction(async (tx) => {
            const [newMedia] = await tx.insert(media).values({
                ownerId: session.user.id,
                    filename: data.filename,
                    mimetype: data.mimetype,
                    size: data.size,
                    objectKey: data.objectKey,
                    storageBackendId: data.storageBackendId,
                    hash: "pending",
            }).returning();

            await tx.update(users)
                .set({
                    storageUsed: sql`${users.storageUsed} + ${sizeInMB}`
                })
                .where(eq(users.id, session.user.id));
            
            await addMediaToPipe(newMedia.id)
        });

        await redisCache.del(`user_photos_timeline:${session.user.id}`);

        revalidatePath("/photos");
        revalidatePath("/albums", "layout")
        return { success: true};
    }  catch (error) {
        console.error("database inset eror", error);
        throw new Error("failed to save media record to db")
    }
}