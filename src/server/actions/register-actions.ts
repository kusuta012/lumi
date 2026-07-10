"use server";

import { db } from "@/db";
import { users, roles } from "@/db/schema"
import { eq } from "drizzle-orm";
import { hash } from "bcrypt";
import { checkRateLimit } from "@/lib/rate-limit";
import { isFlipperEnabled } from "@/lib/flippers";
import { BLOOM_KEYS, bloomFilter } from "@/lib/bloom";

export async function publicRegisterAction(prevState: any, formData: FormData) {
    const rateLimit = await checkRateLimit("register", 3, 3600);
    if (!rateLimit.allowed) {
        const minutesLeft = await checkRateLimit("register", 3, 3600);
        return { error: `Too many registration attemps. Please try again later in ${minutesLeft} minutes` };
    }

    const isOpen = await isFlipperEnabled("registration_enabled");
    if (!isOpen) return { error: "Registration is currently disabled by the admin"};

    const username = formData.get("username") as string;
    const email = formData.get("email") as string;
    
    const [usernameMayExist, emailMayExist] = await Promise.all([
        bloomFilter.mightExist(BLOOM_KEYS.USERNAMES, username),
        bloomFilter.mightExist(BLOOM_KEYS.EMAILS, email),
    ]);

    if (usernameMayExist) {
        const existing = await db.query.users.findFirst({
            where: eq(users.username, username),
            columns: { id: true }
        });
        if (existing) return { error: "Username is already" };
    }

    if (emailMayExist) {
        const existing = await db.query.users.findFirst({
            where: eq(users.email, email),
            columns: { id: true }
        });
        if (existing) return { error: "Email is already registered" };
    }

    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!username || !email || password.length < 8) {
        return { error: "Invalid input , passwor dmust be atleast 8 characters"};
    }

    if (password !== confirmPassword) {
        return { error: "Password do not match"};
    }


    try {
        let defaultRole = await db.query.roles.findFirst({ where: eq(roles.name, 'Default User') });
        if (!defaultRole) {
            const [newRole] = await db.insert(roles).values({
                name: 'Default User',
                isSystem: true,
                permissions: {
                    can_manage_users: false,
                    can_manage_server: false,
                    can_view_analytics: false,
                    can_change_config: false,
                    can_manage_flippers: false,
                    can_view_audit_log: false,
                    can_manage_others_albums: false,
                    can_view_all_media: false,
                    can_override_quota: false,
                }
            }).returning();
            defaultRole = newRole;
        }

        const passwordHash = await hash(password, 10);
        await db.insert(users).values({
            username,
            email,
            passwordHash,
            roleId: defaultRole.id,
            storageQuota: 5120
        });

        await Promise.all([
            bloomFilter.add(BLOOM_KEYS.USERNAMES, username),
            bloomFilter.add(BLOOM_KEYS.EMAILS, email),
        ]);

        return { success: true };
    } catch (error) {
        console.error(error);
        return { error: "Username or Email already exists"}
    }
}