import { auth } from "@/server/auth";
import type { PermissionKey } from "./permissions";

export async function requirePermission(...keys: PermissionKey[]) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const perms = session.user.permissions;
    if (!perms) {
        throw new Error("No permissions found in session");
    }

    for (const key of keys) {
        if (!perms[key]) {
            throw new Error(`Forbidden: missing permission ${key}`);
        }
    }

    return session;
}

export async function hasPermission(key: PermissionKey): Promise<boolean> {
    const session = await auth();
    if (!session?.user?.id) return false;
    return !!session.user.permissions?.[key];
}
