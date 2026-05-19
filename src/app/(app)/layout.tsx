import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { eq } from "drizzle-orm";
import { db } from "@/db"
import { users } from "@/db/schema"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    const userStats = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        columns: { storageUsed: true, storageQuota: true }
    })

    return (
        <div className="flex h-screen bg-[#0a0a0a] text-neutral-200 overflow-hidden font-sans">
            <Sidebar userRole={session.user.roleName} storageUsed={userStats?.storageUsed || 0} storageQuota={userStats?.storageQuota || 5120} />
            <div className="flex-1 flex flex-col min-w-0">
                <Topbar user={session.user} />
                <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
                    {children}
                </main>
            </div>
        </div>
    );
}