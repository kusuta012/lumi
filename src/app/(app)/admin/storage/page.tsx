import { db } from "@/db";
import { storageBackends, platformConfig, auditLogs} from "@/db/schema";
import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import StorageBackendForm from "@/components/admin/StorageBackendForm";
import MigrationPanel from "@/components/admin/MigrationPanel";
import SetDefaultButton from "@/components/admin/SetDefaultButton";
import DeleteBackendButton from "@/components/admin/DeleteBackendButton";
import SystemBackupBtn from "@/components/admin/SystemBackupButton";
import { getStorageClient } from "@/lib/storage";
import { format } from "date-fns";
import { Clock, Download } from "lucide-react";

export default async function AdminStoragePage() {
    const session = await auth();
    if (session?.user?.roleName !== "Super Admin") redirect("/photos");

    const backends = await db.query.storageBackends.findMany();
    const maintenanceConfig = await db.query.platformConfig.findFirst({ where: eq(platformConfig.key, 'maintenance_mode') });
    const isMaintenanceMode = Boolean(maintenanceConfig?.value);
    const recentBackups = await db.query.auditLogs.findMany({
        where: eq(auditLogs.action, "system_backup_completed"),
        orderBy: [desc(auditLogs.createdAt)],
        limit: 5
    });
    const defaultBackend = backends.find(b => b.isDefault);
    const storageEngine = getStorageClient(defaultBackend?.config);
    const hasDbDefault = backends.some(b => b.isDefault);
    const envBackend = {
        id: 'env',
        name: 'Default Server Storage (.env)',
        type: 'minio',
        isDefault: !hasDbDefault,
        isEnv: true,
        config: null
    }
    const allDrives = [envBackend, ...backends];
    const drivesWithLiveStatus = await Promise.all(allDrives.map(async (drive) =>  {
        let isOnline = false;
        try {
            const { client, bucket } = getStorageClient(drive.config);
            await client.bucketExists(bucket);
            isOnline = true;
        } catch (e) {
            isOnline = false;
        }
        return {...drive, isOnline};
    }));

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <Link href="/admin" className="text-foreground hover:underline text-sm font-bold mb-6 inline-block">
                &larr; Back to Dashboard
            </Link>
            <h1 className="text-2xl font-black text-foreground tracking-tight border-b border-border pb-4 mb-6">
                Storage Manager
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="border border-border bg-background pb-4">
                    <h2 className="text-foreground font-bold text-sm mb-4 ">Connected drives</h2>
                    <div className="space-y-3">
                        {drivesWithLiveStatus.map(b => (
                            <div key={b.id} className={`p-4 border ${b.isDefault ? 'border-orange-500 bg-orange-500/5' : 'border-border bg-surface'} flex justify-between items-center`}>
                            <div>
                                <h3 className="text-foreground font-bold text-sm">{b.name}</h3>
                                <p className="text-[10px] text-muted font-mono mt-1">TYPE: {b.type.toUpperCase()} | STATUS: <span className={b.isOnline ? "text-green-500" : "text-red-500"}>{b.isOnline ? "ONLINE" : "OFFLINE"}</span></p>
                            </div>
                            {b.isDefault ? (
                                <span className="text-[10px] font-bold text-orange-500 border border-orange-500 px-2 py-1">DEFAULT</span>
                            ) : (
                                <SetDefaultButton backendId={b.id} />
                            )}
                                {!(b as any).isEnv && (
                                    <DeleteBackendButton backendId={b.id} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="border border-border bg-background p-4">
                    <StorageBackendForm />
                </div>
            </div>
            <div className={`border-2 p-6 ${isMaintenanceMode ? 'border-red-500/50 bg-red-500/5' : 'border-border bg-background'}`}>
                <h2 className="text-foreground font-bold text-sm mb-2 flex items-center gap-2">
                    Data migration
                </h2>
                {!isMaintenanceMode ? (
                    <p className="text-sm text-muted mb-4">You must enable Maintenance mode to migrate data between drives</p>
                ) : (
                    <MigrationPanel backends={backends} />
                )}
            </div>
            <div className="border border-border bg-background p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-foreground font-bold text-sm flex items-center gap-2">
                            System DB Backups
                        </h2>
                        <p className="text-xs text-muted mt-1">
                            Snapshots contails all users, tags, albums, and ml vectors.
                        </p>
                    </div>
                    <SystemBackupBtn />
                </div>
                {recentBackups.length > 0 ? (
                    <div className="divide-y divide-border border border-border rounded-lg overflow-hidden bg-surface">
                        {recentBackups.map(async (log) => {
                            const details = log.details as any;
                            const downloadUrl = await storageEngine.client.presignedGetObject(storageEngine.bucket, details.file, 3600);
                            const sizeMB = details.size ? (details.size / 1024 / 1024).toFixed(2) : "Unknown";
                            return (
                                <div key={log.id} className="p-4 flex items-center justify-between hover:bg-surface-hover transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <p className="text-sm font-bold text-foreground truncate max-w-[200px] sm:max-w-md">
                                                {details.file.split('/').pop()}
                                            </p>
                                            <p className="text-[10px] text-muted mt-1 uppercase tracking-wider font-semibold flex items-center gap-2">
                                                <Clock size={10} /> {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a")}
                                                <span className="mx-1">|</span>
                                                {sizeMB} MB
                                            </p>
                                        </div>
                                    </div>
                                    <a href={downloadUrl} download className="p-2 text-muted hover:text-orange-500 hover:bg-orange-500/10 rounded-lg transition-colors">
                                        <Download size={18} />
                                    </a>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="py-8 text-center border border-dashed border-border rounded-lg bg-surface">
                        <p className="text-sm text-muted font-medium">No database snapshots found</p>
                        <p className="text-xs text-muted mt-1">Click the button above to generate your backup</p>
                    </div>
                )}
            </div>
        </div>
    );
}