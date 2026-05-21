"use client";

import { useTransition } from "react";
import { toggleMaintenanceMode } from "@/server/actions/storage-actions";

export default function MaintenanceToggle({ isEnabled }: { isEnabled: boolean }) {
    const [isPending, startTransition] = useTransition();

    return (
        <div className="flex items-center justify-between p-3 border border-neutral-700 bg-[#111]">
            <div>
                <span className="text-white font-bold text-sm block">Maintenance mode</span>
                <span className="text-neutral-500 text-[10px]">
                    {isEnabled ? "Under maintenance" : "Operational"}
                </span>
            </div>

            <button onClick={() => startTransition(async () => { await toggleMaintenanceMode(isEnabled); })} disabled={isPending} className={`px-4 py-1.5 text-xs font-bold border transition-none disabled:opacity-50 ${isEnabled ? 'border-red-500 hover:bg-red-500 hover:text-black' : 'border-neutral-500 text-neutral-500 hover:border-white hover:text-white'}`}> {isEnabled ? "Active" : "Disabled"} </button>
        </div>
    );
}