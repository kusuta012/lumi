"use server";

import { db } from "@/db";
import { users, roles } from "@/db/schema"
import { eq } from "drizzle-orm";
import { hash } from "bcrypt";
import { checkRateLimit } from "@/lib/rate-limit";
import { isFlipperEnabled } from "@/lib/flippers";

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

        return { success: true };
    } catch (error) {
        console.error(error);
        return { error: "Username or Email already exists"}
    }
}