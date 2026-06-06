import { db } from "@/db";
import { users, auditLogs } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/server/auth";
import { Settings, Package, Clock, ExternalLink } from "lucide-react";
import MfaSetup from "@/components/profile/MfaSetup";
import TakeoutBtn from "@/components/settings/TakeoutButton";
import { format } from "date-fns";
import { redirect } from "next/navigation";

export default async function SettingsPg () {
    const session = await auth();
    if (!session?.user?.id) return null;

    const user = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        columns: { mfaEnabled: true }
    }); // I AM HUNGRY I NEDED FOOOD RAADDAWF
    const completedTakeouts = await db.query.auditLogs.findMany({
        where: and(
            eq(auditLogs.actorId, session.user.id),
            eq(auditLogs.action, "takeout_generated")
        ),
        orderBy: [desc(auditLogs.createdAt)],
        limit: 5
    });

    return (
        <div className="p-8 max-w-3xl mx-auto space-y-12 text-foreground">
            <header className="border-b border-border pb-6">
                <h1 className="text-3xl font-black text-foreground flex items-center gap-3 tracking-tight">
                    <Settings className="text-foreground w-8 h-8" /> Account Settings
                </h1>
                <p className="text-muted text-sm mt-2">Manage your profile and other settings</p>
            </header>
            <section>
                <MfaSetup initialEnabled={Boolean(user?.mfaEnabled)} />
            </section>
            <section className="space-y-6 pt-6 border-t border-border">
                <div>
                    <h2 className="text-lg font-bold text-foreground">Takeout</h2>
                    <p className="text-sm text-muted mt-1">
                        Download a copy of all your media.
                        Because this process takes time, you can request a takeout and return here later to download it.
                    </p>
                </div>
                <TakeoutBtn />
                {completedTakeouts.length > 0 && (
                    <div className="mt-8 border border-border rounded-xl overflow-hidden bg-surface shadow-sm">
                        <div className="bg-surface-hover px-4 py-3 border-b border-border">
                            <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Available Downloads</h3>
                        </div>
                        <div className="divide-y divide-border">
                            {completedTakeouts.map((log) => {
                                const details = log.details as any;
                                return (
                                    <div key={log.id} className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-orange-500/10 rounded-full text-orange-500 shrink-0">
                                                <Package size={20} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-foreground flex items-center gap-2">
                                                    Takeout Ready
                                                    <span className="text-[10px] font-medium px-2 py-0.5 bg-background rounded-full border border-border text-muted">
                                                        {details?.itemCount} items
                                                    </span>
                                                </p>
                                                <p className="text-xs text-muted mt-1 flex items-center gap-1.5">
                                                    <Clock size={12} /> Generated {format(new Date(log.createdAt), "MMMd, yyyy 'at' h:mm a")}
                                                </p>
                                            </div>
                                        </div>
                                        <a href={details?.url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg text-sm font-medium transition-colors active:scale-95 flex items-center gap-2 shrink-0">
                                            Download <ExternalLink size={16} />
                                        </a>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}