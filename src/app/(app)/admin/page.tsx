import { db } from "@/db";
import { users, media } from "@/db/schema";
import { count, sum, sql } from "drizzle-orm";
import { minioClient, BUCKET_NAME } from "@/lib/storage";
import RegistrationToggle from "@/components/admin/RegistrationToggle";
import { getRegistrationSetting } from "@/server/actions/config-actions";
import Link from "next/link";
import os from "os";
import { getMaintenanceSetting } from "@/server/actions/storage-actions";
import MaintenanceToggle from "@/components/admin/MaintenanceToggle";

async function checkDatabase() {
    try {
        await db.execute(sql`SELECT 1`);
        return { status: "ONLINE", color: "text-green-500" };
    } catch {
        return { status: "OFFLINE", color: "text-red-500"};
    }
}

async function checkMinIO() {
    try {
        await minioClient.bucketExists(BUCKET_NAME);
        return { status: "ONLINE", color: "text-green-500" };
    } catch {
        return { status: "OFFLINE", color: "text-red-500" };
    }
}

function getRamUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    return {
        usedStr: (used / 1024 / 1024 / 1024).toFixed(2),
        totalStr: (used / 1024 / 1024 / 1024).toFixed(2),
        percent: Math.round((used / total) * 100)
    };
}

export default async function AdminPage() {
    const allowReg = await getRegistrationSetting();
    const isMaintenance = await getMaintenanceSetting();
    const ram = getRamUsage();

    const [userCountResult] = await db.select({ value: count() }).from(users);
    const [mediaResult] = await db.select({ totalAssets: count(), totalBytes: sum(media.size) }).from(media);
    
    const storageUsedGB = mediaResult.totalBytes ? (Number(mediaResult.totalBytes) / 1024 / 1024 /1024).toFixed(2) : "0.00";
    const dbHealth = await checkDatabase();
    const minioHealth = await checkMinIO();

    return (
        <div className="p-6 max-w-6xl mx-auto font-sans">
            <h1 className="text-2xl font-black text-grey-500 mb-6 tracking-tight">
                Super Mega Dashboard
            </h1>

            <div className="p-6 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h2 className="text-white font-bold mb-4 border-b border-orange-600/30 pb-2">
                            Live Information
                        </h2>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                            <div className="flex flex-col">
                                <span className="text-neutral-500 uppercase text-[10px] font-bold">Total Users</span>
                                <span className="text-white font-mono text-lg">{userCountResult.value.toString()}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-neutral-500 uppercase text-[10px] font-bold">Total Assets</span>
                                <span className="text-white font-mono text-lg">{mediaResult.totalAssets.toString()}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-neutral-500 uppercase text-[10px] font-bold">Storage Used</span>
                                <span className="text-white font-mono text-lg">{storageUsedGB} GB</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-neutral-500 uppercase text-[10px] font-bold">RAM ({ram.percent}%)</span>
                                <span className="text-white font-mono text-lg">{ram.usedStr} / {ram.totalStr} GB</span>
                            </div>
                        </div>
                        <div className="mt-6">
                            <span className="text-neutral-500 uppercase text-[10px] font-bold block mb-2">Service Health</span>
                            <table className="w-full text-sm text-left text-neutral-300 font-mono">
                                <tbody>
                                    <tr className="border-t border-neutral-800">
                                        <td className="py-1.5">PostgreSQL</td>
                                        <td className={`py-1.5 text-right font-medium ${dbHealth.color}`}>{dbHealth.status}</td>
                                    </tr>
                                    <tr className="border-t border-neutral-800">
                                        <td className="py-1.5">MinIO storage</td>
                                        <td className={`py-1.5 text-right font-medium ${minioHealth.color}`}>{minioHealth.status}</td>
                                    </tr>
                                    <tr className="border-t border-neutral-800">
                                        <td className="py-1.5">Redis workers</td>
                                        {/* <td className={`py-1.5 text-right font-medium ${dbHealth.color}`}>{dbHealth.status}</td> */}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="md:pl-8">
                        <h2 className="text-grey-500 font-bold mb-4 pb-2">
                            Main Switches
                        </h2>
                        <div className="space-y-4">
                            <RegistrationToggle isEnabled={allowReg} />
                            <MaintenanceToggle isEnabled={isMaintenance} />
                            <div className="flex items-center justify-between p-3 opacity-50">
                                <div>
                                    <span className="text-white font-bold text-sm block">Maintenance Mode</span>
                                    <span className="text-neutral-500 text-xs">Lock server to admins only</span>
                                </div>
                                <div className="w-10 h-5 bg-neutral-700 rounded-sm"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Link href="/admin/users" className="border border-neutral-700 p-3 text-center text-sm font-bold text-neutral-300 hover:border-orange-500 hover:text-orange-500 transition-none bg-[#0a0a0a]">
                    USER MANAGEMENT
                </Link>
                <Link href="/admin/storage" className="border border-neutral-700 p-3 text-center text-sm font-bold text-neutral-300 hover:border-orange-500 hover:text-orange-500 transition-none bg-[#0a0a0a]">
                    STORAGE CONFIG
                </Link>
                <Link href="/admin/users" className="border border-neutral-700 p-3 text-center text-sm font-bold text-neutral-300 hover:border-orange-500 hover:text-orange-500 transition-none bg-[#0a0a0a]">
                    WORKER QUEUES
                </Link>
                <Link href="/admin/users" className="border border-neutral-700 p-3 text-center text-sm font-bold text-neutral-300 hover:border-orange-500 hover:text-orange-500 transition-none bg-[#0a0a0a]">
                    SYSTEM LOGS
                </Link>
            </div>
        </div>
    )
}