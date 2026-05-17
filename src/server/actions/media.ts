"use server";

import { db } from "@/db";
import { media } from "@/db/schema";
import { auth } from "@/server/auth";
import { revalidatePath } from "next/cache";

export async function recordMediaUpload(data: {
    filename: string;
    mimetype: string;
    size: number;
    objectKey: string;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");
    
    try {
        await db.insert(media).values({
            ownerId: session.user.id,
            filename: data.filename,
            mimetype: data.mimetype,
            size: data.size,
            objectKey: data.objectKey,
            hash: "pending",
        });

        revalidatePath("/photos");
        return { success: true};
    }  catch (error) {
        console.error("database inset eror", error);
        throw new Error("failed to save media record to db")
    }
}