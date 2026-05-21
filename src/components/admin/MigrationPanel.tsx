"use client";

import { useState, useTransition } from "react";
import { triggerMigration } from "@/server/actions/storage-actions";

export default function MigrationPanel({ backends }: { backends: any[] }) {
    const [source, setSource] = useState("");
    const [target, setTarget] = useState("");
    const [isPending, startTransition] = useTransition();

    const handleMigrate = () => {
        if (source === target) return alert("source and target must be diffrent");
        if (confirm("Begin migrating data? any interruption might lead to corrupt data")) {
            startTransition(async () => {
                const res = await triggerMigration(source, target);
                if (!res.success) alert(res.error);
                else alert("migration job queued");
            });
        }
    };

    return (
        <div className="flex flex-col md:flex-row items-end gap-4">
            <div className="flex-1 w-full">
                <label className="text-[10px] font-bold text-neutral-500 block mb-1">Source drive</label>
                <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full bg-[#111] border border-neutral-700 text-sm p-2 text-white">
                    <option value="">Select source</option>
                    <option value="env">Default Storage (.env)</option>
                    {backends.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
            </div>
            <div className="flex-1 w-full">
                <label className="text-[10px] font-bold text-neutral-500 block mb-1">Destination drive</label>
                <select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full bg-[#111] border border-neutral-700 text-sm p-2 text-white">
                    <option value="">Select source</option>
                    <option value="env">Default Storage (.env)</option>
                    {backends.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
            </div>
            <button onClick={handleMigrate} disabled={isPending || !source || !target} className="w-full md:w-auto px-6 py-2 bg-red-600 text-white font-bold text-xs hover:bg-red-700 disabled:opacity-50 transition-none">
                {isPending ? "Starting..." : "Start Migration"}
            </button>
        </div>
    );
}

