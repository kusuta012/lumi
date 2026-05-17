import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    return (
        <div className="flex h-screen bg-[#0a0a0a] text-neutral-200 overflow-hidden font-sans">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <Topbar user={session.user} />
                <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
                    {children}
                </main>
            </div>
        </div>
    );
}