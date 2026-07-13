import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { getAllRoles } from "@/server/actions/admin-actions";
import Link from "next/link";
import RoleManager from "@/components/admin/RoleManager";

export default async function RolesPg() {
    const session = await auth();
    if (!session?.user?.permissions?.can_manage_users) redirect("/photos");

    const roles = await getAllRoles();

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <Link href="/admin" className="text-foreground hover:underline text-sm font-bold mb-6 inline-block">
                &larr; Back to Dashboard
            </Link>
            <h1 className="text-2xl font-black text-foreground tracking-tight border-b border-border pb-4 mb-6">
                Role Management
            </h1>
            <RoleManager roles={roles} />
        </div>
    );
}