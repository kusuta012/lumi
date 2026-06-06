"use client";

import { useTransition } from "react";
import { triggerSystemBackup } from "@/server/actions/admin-actions";
import { useNotification } from "../providers/NotificationProvider";
import { Database, Loader2 } from "lucide-react";

export default function SystemBackupBtn() {
    const { notify } = useNotification();
    const [isPending, startTransition] = useTransition();
    const handleBackup = () => {
        startTransition(async () => {
            const res = await triggerSystemBackup();
            if (res.success) {
                notify("success", "Backup queued", "The database snapshot is being generated in the background");
            } else {
                notify("error", "Error", res.error || "Failed to start backup");
            }
        });
    };

    return (
        <button onClick={handleBackup} disabled={isPending} className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg text-sm font-medium transition-colors active:scale-95 disabled:opacity-50">
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
            {isPending ? "Generating snaptshot..." : "Generate Database Snapshot"}
        </button>
    );
}