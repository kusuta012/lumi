import { db } from "@/db";
import { storageBackends, platformConfig } from "@/db/schema";
import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import StorageBackendForm from "@/components/admin/StorageBackendForm";
import MigrationPanel from "@/components/admin/MigrationPanel";
import SetDefaultButton from "@/components/admin/SetDefaultButton";
import DeleteBackendButton from "@/components/admin/DeleteBackendButton";
import { getStorageClient } from "@/lib/storage";

export default async function AdminStoragePage() {
    const session = await auth();
    if (session?.user?.roleName !== "Super Admin") redirect("/photos");

    const backends = await db.query.storageBackends.findMany();
    const maintenanceConfig = await db.query.platformConfig.findFirst({ where: eq(platformConfig.key, 'maintenance_mode') });
    const isMaintenanceMode = Boolean(maintenanceConfig?.value);

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
            <Link href="/admin" className="text-orange-500 hover:underline text-sm font-bold mb-6 inline-block">
                &larr; Back to Dashboard
            </Link>
            <h1 className="text-2xl font-black text-white tracking-tight border-b border-neutral-800 pb-4 mb-6 flex items-center gap-3">
                storage manager
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="border border-neutral-800 bg-[#0a0a0a] pb-4">
                    <h2 className="text-white font-bold text-sm mb-4 ">Connected drives</h2>
                    <div className="space-y-3">
                        {drivesWithLiveStatus.map(b => (
                            <div key={b.id} className={`p-4 border ${b.isDefault ? 'border-orange-500 bg-orange-500/5' : 'border-neutral-800 bg-[#111]'} flex justify-between items-center`}>
                            <div>
                                <h3 className="text-white font-bold text-sm">{b.name}</h3>
                                <p className="text-[10px] text-neutral-500 font-mono mt-1">TYPE: {b.type.toUpperCase()} | STATUS: <span className={b.isOnline ? "text-green-500" : "text-red-500"}>{b.isOnline ? "ONLINE" : "OFFLINE"}</span></p>
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

                <div className="border border-neutral-800 bg-[#0a0a0a] p-4">
                    <StorageBackendForm />
                </div>
            </div>
            <div className={`border-2 p-6 ${isMaintenanceMode ? 'border-red-500/50 bg-red-500/5' : 'border-neutral-800 bg-[#0a0a0a]'}`}>
                <h2 className="text-white font-bold text-sm mb-2 flex items-center gap-2">
                    Data migration
                </h2>
                {!isMaintenanceMode ? (
                    <p className="text-sm text-neutral-500 mb-4">You must enable Maintenance mode to migrate data between drives</p>
                ) : (
                    <MigrationPanel backends={backends} />
                )}
            </div>
        </div>
    )
}