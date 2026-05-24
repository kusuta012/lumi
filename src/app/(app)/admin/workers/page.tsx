import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getQueueStats } from "@/server/actions/worker-actions";
import QueueCard from "@/components/admin/QueueCard";

export default async function AdminWorkers() {
    const session = await auth();
    if (session?.user?.roleName !== "Super Admin") redirect("/photos");

    const res = await getQueueStats();
    if (!res.success) {
        return (
            <div className="p-8 max-w-5xl mx-auto text-center space-y-4 bg-background text-foreground font-sans">
                <h1 className="text-xl font-bold">Queue Error</h1>
                <p className="text-sm text-muted">Failed to connect to redis. Ensure its container is running</p>
                <Link href="/admin" className="text-foreground hover:underline">Back to dashboard</Link>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8 bg-background text-foreground font-sans">
            <Link href="/admin" className="text-foreground hover:underline text-sm font-bold mb-6 inline-block">
                &larr; Back to Dashboard
            </Link>
            <header className="mb-10 border-b border-border pb-6">
                <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
                    Worker Queues
                </h1>
            </header>
            <div className="space-y-6">
                {res.queues?.map((q: any) => (
                    <QueueCard key={q.name} queue={q} />
                ))}
            </div>
            {/* <div className="border border-border bg-surface overflow-hidden mt-12">
                <div className="p-4 overflow-x-auto">
                    <pre className="text-[15px] text-foreground">
                        {JSON.stringify(res.queues, null, 2)}
                    </pre> // This was just to debug the stuff 
                </div>
            </div> */}
        </div>
    );
}