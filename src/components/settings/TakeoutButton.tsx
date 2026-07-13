"use client";

import { useState, useTransition } from "react";
import { DownloadCloud, Loader2 } from "lucide-react";
import { requestTakeout } from "@/server/actions/takeout-actions";
import { useNotification } from "../providers/NotificationProvider";

export default function takeoutBtn() {
    const { notify } = useNotification();
    const [isPending, startTransition] = useTransition();
    const handleRequest = () => {
        startTransition(async () => {
            const res = await requestTakeout();
            if (res.success) {
                notify("success", "Takeout started", "We are gathering your files. Check back here in few minutes!");
            } else {
                notify("error", "Error", res.error || "Failed to start takeout");
            }
        });
    };

    return (
        <button onClick={handleRequest} disabled={isPending} className="flex items-center gap-3 px-4 py-2.5 bg-surface-hover border border-border rounded-lg text-sm font-medium text-foreground transition-all active:scale-95 disabled:opacity-50">
            {isPending ? <Loader2 size={18} className="animate-spin text-orange-500" /> : <DownloadCloud size={18} className="text-orange-500" />}
            {isPending ? "Starting Backup..." : "Request Data Export"}
        </button>
    );
}