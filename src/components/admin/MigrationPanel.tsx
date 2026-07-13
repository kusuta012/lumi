"use client";

import { useState, useTransition } from "react";
import { triggerMigration } from "@/server/actions/storage-actions";
import { useNotification } from "../providers/NotificationProvider";

export default function MigrationPanel({ backends }: { backends: any[] }) {
    const [source, setSource] = useState("");
    const [target, setTarget] = useState("");
    const [isPending, startTransition] = useTransition();
    const { notify } = useNotification();

    const handleMigrate = () => {
        if (source === target) return notify("error", "Exception", "source and target must be diffrent");
        if (confirm("Begin migrating data? any interruption might lead to corrupt data")) {
            startTransition(async () => {
                const res = await triggerMigration(source, target);
                if (!res.success) notify("error", "Error", `${res.error}`);
                else notify("info", "Queued", "migration job queued");
            });
        }
    };

    return (
        <div className="flex flex-col md:flex-row items-end gap-4">
            <div className="flex-1 w-full">
                <label className="text-[10px] font-bold text-muted block mb-1">Source drive</label>
                <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full bg-surface border border-border text-sm p-2 text-foreground">
                    <option value="">Select source</option>
                    <option value="env">Default Storage (.env)</option>
                    {backends.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
            </div>
            <div className="flex-1 w-full">
                <label className="text-[10px] font-bold text-muted block mb-1">Destination drive</label>
                <select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full bg-surface border border-border text-sm p-2 text-foreground">
                    <option value="">Select source</option>
                    <option value="env">Default Storage (.env)</option>
                    {backends.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
            </div>
            <button onClick={handleMigrate} disabled={isPending || !source || !target} className="w-full md:w-auto px-6 py-2 bg-red-600 text-foreground font-bold text-xs hover:bg-red-700 disabled:opacity-50 transition-none">
                {isPending ? "Starting..." : "Start Migration"}
            </button>
        </div>
    );
}

