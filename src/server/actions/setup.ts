"use server";

import { db } from "@/db";
import { users, roles } from "@/db/schema";
import { isSetupComplete } from "../queries/setup";
import { hash } from "bcrypt";
import { redirect } from "next/navigation";

export async function completeSetupAction(prevState: any, formData: FormData) {
    const username = formData.get("username") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
        return { error: "password does not match"};
    }

    const alreadySetup = await isSetupComplete();
    if (alreadySetup) {
        redirect("/login");
    }
    try {
        const [superAdminRole] = await db.insert(roles).values({
            name: 'Super Admin',
            isSystem: true, 
            permissions: {
                can_manage_users: true,
                can_manage_server: true,
                can_view_analytics: true,
                can_change_config: true,
                can_manage_flippers: true,
                can_view_audit_log: true,
                can_manage_others_albums: true,
                can_view_all_media: true,
                can_override_quota: true,
            }
        }).returning();

        const passwordHash = await hash(password, 10);
        await db.insert(users).values({
            username, 
            email,
            passwordHash,
            roleId: superAdminRole.id,
        });
    } catch (error) {
        console.error("setup failed", error);
        return { error: "failed to create super admin "};
    }

    redirect("/login");
}