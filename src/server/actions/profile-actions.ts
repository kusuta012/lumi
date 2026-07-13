"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/server/auth";
import { compare, hash } from "bcrypt";
import { getStorageClient } from "@/lib/storage";
import crypto from "crypto";
import { bloomFilter, BLOOM_KEYS } from "@/lib/bloom";

export async function updateUsername(newUsername: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    if (!newUsername || newUsername.length < 3) return { success: false, error: "Username must be atleast 3 characters" };

    const mightExist = await bloomFilter.mightExist(BLOOM_KEYS.USERNAMES, newUsername);
    if (mightExist) {
        const existing = await db.query.users.findFirst({
            where: eq(users.username, newUsername),
            columns: { id: true }
        });
        if (existing && existing.id !== session.user.id) {
            return { success: false, error: "Username is already taken" };
        }
    }

    try {
        await db.update(users)
            .set({ username: newUsername, UpdatedAt: new Date() })
            .where(eq(users.id, session.user.id));
        await bloomFilter.add(BLOOM_KEYS.USERNAMES, newUsername);
        return { success: true };
    } catch (err: any) {
        if (err.code === '23505') {
            await bloomFilter.add(BLOOM_KEYS.USERNAMES, newUsername);
            return { success: false, error: "Username is already taken" };
        }
        return { success: false, error: "Failed to update username" };
    }
}

export async function updatePassword(currentPass: string, newPass: string, confirmPass: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    if(!newPass || newPass.length < 8) return { success: false, error: "New password must be at least 8 characters" };
    if(newPass !== confirmPass) return { success: false, error: "New passwords do not match" };

    try {
        const user = await db.query.users.findFirst({
            where: eq(users.id, session.user.id)
        });
        if(!user || !user.passwordHash) return { success: false, error: "User not found" };
        const isValid = await compare(currentPass, user.passwordHash);
        if (!isValid) return { success: false, error: "Current password is incorrect" };

        const passwordHash = await hash(newPass, 10);
        await db.update(users)
            .set({ passwordHash, UpdatedAt: new Date() })
            .where(eq(users.id, session.user.id));
        
        return { success: true };
    } catch (err) {
        return { success: false, error: "Failed to update password" };
    }
}

export async function uploadAvatar(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const file = formData.get("file") as File;
    if (!file || !file.type.startsWith("image/")) return { success: false, error: "Invalid file" };

    try {
        const { client, bucket } = getStorageClient(null);
        const ext = file.name.split('.').pop();
        const objectKey = `avatars/${session.user.id}/${crypto.randomBytes(8).toString('hex')}.${ext}`;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const sharp = (await import("sharp")).default;
        const optimized = await sharp(buffer)
            .resize(256, 256, { fit: "cover" })
            .webp({ quality: 80 })
            .toBuffer();
            
        await client.putObject(bucket, objectKey, optimized, optimized.length, {
            'Content-Type': "image/webp",
        });

        const avatarUrl = `/api/media/raw?key=${encodeURIComponent(objectKey)}&bucket=${bucket}`;

        await db.update(users)
            .set({ avatarUrl, UpdatedAt: new Date() })
            .where(eq(users.id, session.user.id));

        return { success: true, avatarUrl };
    } catch (err) {
        console.error("Avatar upload failed", err);
        return { success: false, error: "Failed to upload avatar" };
    }
}