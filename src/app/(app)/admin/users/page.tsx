import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/server/auth";
import { desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import UserManagementTable from "@/components/admin/UserManagementTable";
import GlobalQuotaManger from "../../../../components/admin/GlobalQuotaManager";

export default async function AdminUsersPage() {
    const session = await auth();
    if (session?.user?.roleName !== "Super Admin") redirect("/photos");

    const allUsers = await db.query.users.findMany({
        with: { role: true},
        orderBy: [desc(users.createdAt)]
    });

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <Link href="/admin" className="text-foreground hover:underline text-sm font-bold mb-6 inline-block">
                &larr; Back to Dashboard
            </Link>
            <h1 className="text-2xl font-black text-foreground tracking-tight border-b border-border pb-4 mb-6">
                User Management
            </h1>
            <div className="flex flex-col lg:flex-row gap-6">
                <GlobalQuotaManger />
                <div className="lg:w-2/3 border border-border bg-background p-4">
                    <h2 className="text-foreground font-bold text-sm mb-4">Current users</h2>
                    <UserManagementTable users={allUsers} />
                </div>
            </div>
        </div>
    )
}