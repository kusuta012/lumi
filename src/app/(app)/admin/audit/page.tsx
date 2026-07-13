import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { auth } from "@/server/auth";
import { eq, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";

export default async function AdminLogs() {
    const session = await auth();
    if (session?.user?.roleName !== "Super Admin") redirect("/photos");

    const logs = await db.select({
        id: auditLogs.id,
        action: auditLogs.action,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
        actorName: users.username,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6 text-foreground">
            <Link href="/admin" className="text-foreground hover:underline text-sm font-bold mb-6 inline-block">
                &larr; Back to Dashboard
            </Link>
            <header className="mb-10">
            <h1 className="text-2xl font-black text-foreground tracking-tight border-b border-border pb-4 mb-6">
                Audit Logs
            </h1>
            </header>

            <div className="border border-border bg-surface rounded-xl overflow-hidden shadow-2xl">
                <div className="bg-surface-hover px-4 py-3 border-b border-border flex items-center gap-2">
                    <span className="font-bold text-muted">Logs</span>
                </div>
                <div className="p-4 overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="border-b border-border text-muted font-bold">
                                <th className="py-2 pr-4">Timestamp</th>
                                <th className="py-2 pr-4">Actor</th>
                                <th className="py-2 pr-4 text-orange-500">Action</th>
                                <th className="py-2 pr-4">Target</th>
                                <th className="py-2">Payload</th>
                            </tr>
                        </thead>
                        <tbody className="text-foreground divide-y divide-border">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-muted">No events recorded in system log yet</td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-surface-hover">
                                        <td className="py-3 pr-4 text-muted shrink-0 whitespace-nowrap">
                                            {format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss")}
                                        </td>
                                        <td className="py-3 pr-4 font-bold text-muted">
                                            {log.actorName ? `@${log.actorName}` : "SYSTEM"}
                                        </td>
                                        <td className="py-3 pr-4 font-black text-orange-500 whitespace-nowrap">
                                            {log.action}
                                        </td>
                                        <td className="py-3 pr-4 text-muted whitespace-nowrap">
                                            {log.targetType ? `${log.targetType.toUpperCase()}(${log.targetId?.slice(0, 8)})` : "-"}
                                        </td>
                                        <td className="py-3 text-muted text-[11px] max-w-xs truncate">
                                            {log.details ? JSON.stringify(log.details) : "-"}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}