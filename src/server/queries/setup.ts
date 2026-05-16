import { db } from "@/db";
import { users, roles } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function isSetupComplete() {
    const superAdminRole = await db.query.roles.findFirst({
        where: eq(roles.name, 'Super Admin')
    });

    if (!superAdminRole) return false;

    const adminUser = await db.query.users.findFirst({
        where: eq(users.roleId, superAdminRole.id)
    });

    return !!adminUser;
}