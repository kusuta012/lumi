import { db } from "@/db";
import { users, media } from "@/db/schema";
import { count, sum, sql } from "drizzle-orm";
import { minioClient, BUCKET_NAME } from "@/lib/storage";
import RegistrationToggle from "@/components/admin/RegistrationToggle";
import { getRegistrationSetting, getVidTranscodeSettings } from "@/server/actions/config-actions";
import Link from "next/link";
import os from "os";
import { getMaintenanceSetting } from "@/server/actions/storage-actions";
import MaintenanceToggle from "@/components/admin/MaintenanceToggle";
import { cacheRedis } from "@/lib/cache";
import VideoTranscode from "@/components/admin/VideoTranscode";
import AiModelSettings from "@/components/admin/AiModelSettings";
import { getAiSettings } from "@/server/actions/config-actions";

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

async function checkRedis() {
    try {
        const pong = await cacheRedis.ping();
        return pong === "PONG" ? { status: "ONLINE", color: "text-green-500" } : { status: "DEGRADED", color: "text-red-500" };
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
        totalStr: (total / 1024 / 1024 / 1024).toFixed(2),
        percent: Math.round((used / total) * 100)
    };
}

export default async function AdminPage() {
    const allowReg = await getRegistrationSetting();
    const isMaintenance = await getMaintenanceSetting();
    const transcodeSettings = await getVidTranscodeSettings();
    const aiSettings = await getAiSettings();
    const ram = getRamUsage();

    const [userCountResult] = await db.select({ value: count() }).from(users);
    const [mediaResult] = await db.select({ totalAssets: count(), totalBytes: sum(media.size) }).from(media);
    
    const storageUsedGB = mediaResult.totalBytes ? (Number(mediaResult.totalBytes) / 1024 / 1024 /1024).toFixed(2) : "0.00";
    const dbHealth = await checkDatabase();
    const minioHealth = await checkMinIO();
    const redisHealth = await checkRedis();

    return (
        <div className="p-6 max-w-6xl mx-auto font-sans">
            <h1 className="text-2xl font-black text-muted mb-6 tracking-tight">
                Super Mega Dashboard
            </h1>

            <div className="p-6 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h2 className="text-foreground font-bold mb-4 border-b border-orange-600/30 pb-2">
                            Live Information
                        </h2>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                            <div className="flex flex-col">
                                <span className="text-muted uppercase text-[10px] font-bold">Total Users</span>
                                <span className="text-foreground font-mono text-lg">{userCountResult.value.toString()}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-muted uppercase text-[10px] font-bold">Total Assets</span>
                                <span className="text-foreground font-mono text-lg">{mediaResult.totalAssets.toString()}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-muted uppercase text-[10px] font-bold">Storage Used</span>
                                <span className="text-foreground font-mono text-lg">{storageUsedGB} GB</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-muted uppercase text-[10px] font-bold">RAM ({ram.percent}%)</span>
                                <span className="text-foreground font-mono text-lg">{ram.usedStr} / {ram.totalStr} GB</span>
                            </div>
                        </div>
                        <div className="mt-6">
                            <span className="text-muted uppercase text-[10px] font-bold block mb-2">Service Health</span>
                            <table className="w-full text-sm text-left text-foreground font-mono">
                                <tbody>
                                    <tr className="border-t border-border">
                                        <td className="py-1.5">PostgreSQL</td>
                                        <td className={`py-1.5 text-right font-medium ${dbHealth.color}`}>{dbHealth.status}</td>
                                    </tr>
                                    <tr className="border-t border-border">
                                        <td className="py-1.5">MinIO storage</td>
                                        <td className={`py-1.5 text-right font-medium ${minioHealth.color}`}>{minioHealth.status}</td>
                                    </tr>
                                    <tr className="border-t border-border">
                                        <td className="py-1.5">Redis workers</td>
                                        <td className={`py-1.5 text-right font-medium ${redisHealth.color}`}>{redisHealth.status}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="md:pl-8">
                        <h2 className="text-muted font-bold mb-4 pb-2">
                            Main Switches
                        </h2>
                        <div className="space-y-4">
                            <RegistrationToggle isEnabled={allowReg} />
                            <MaintenanceToggle isEnabled={isMaintenance} />
                        </div>
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Link href="/admin/users" className="border border-border p-3 text-center text-sm font-bold text-foreground hover:border-orange-500 hover:text-orange-500 transition-none bg-background">
                    USER MANAGEMENT
                </Link>
                <Link href="/admin/storage" className="border border-border p-3 text-center text-sm font-bold text-foreground hover:border-orange-500 hover:text-orange-500 transition-none bg-background">
                    STORAGE CONFIG
                </Link>
                <Link href="/admin/workers" className="border border-border p-3 text-center text-sm font-bold text-foreground hover:border-orange-500 hover:text-orange-500 transition-none bg-background">
                    WORKER QUEUES
                </Link>
                <Link href="/admin/audit" className="border border-border p-3 text-center text-sm font-bold text-foreground hover:border-orange-500 hover:text-orange-500 transition-none bg-background">
                    AUDIT LOGS
                </Link>
                <Link href="/admin/roles" className="border border-border p-3 text-center text-sm font-bold text-foreground hover:border-orange-500 hover:text-orange-500 transition-none bg-background">
                    ROLE MANAGEMENT
                </Link>
                <Link href="/admin/config" className="border border-border p-3 text-center text-sm font-bold text-foreground hover:border-orange-500 hover:text-orange-500 transition-none bg-background">
                    PROCESS CONFIG
                </Link>
            </div>
        </div>
    )
}