"use client";

import { useState, useTransition } from "react";
import { updateAllUsersQuotaAction } from "@/server/actions/admin-actions";
import { HardDrive } from "lucide-react";
import { useNotification } from "../providers/NotificationProvider";

export default function GlobalQuotaManger() {
    const [isPending, startTransition] = useTransition();
    const [val, setVal] = useState(5);
    const { notify } = useNotification();

    const handleBulkUpdate = () => {
        const mb = val * 1024;
        if (confirm(`Set storage quota to ${val}GB for ALL users? this will override individual settings`)) {
            startTransition(async () => {
                await updateAllUsersQuotaAction(mb);
                notify("success", "Done", `All users updated to " + ${val} + "GB"`);
            });
        }
    };

    return (
        <div className="border border-orange-600/30 bg-[#0d0d0d] p-4 flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
                <HardDrive className="text-white" size={20} />
                <div>
                    <span className="text-white font-bold text-xs block">Global Storage Policty</span>
                    <span className="text-neutral-500 text-[10px]">Update quota for every account on this server</span>
                </div>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-32">
                    <input type="number" value={val} onChange={(e) => { const inputVal = Number(e.target.value); setVal(inputVal < 1 ? 1 : inputVal ); }} className="w-full bg-black border border-neutral-700 px-3 py-1.5 text-sm text-white font-mono focus:border-orange-500 outline-none" />
                    <span className="absolute right-3 top-1.5 text-[10px] text-neutral-500 font-bold">GB</span>
                </div>
                <button onClick={handleBulkUpdate} disabled={isPending} className="px-4 py-1.5 bg-orange-600 text-black text-[10px] font-black hover:bg-orange-500 transition-none disabled:opacity-50">
                    Apply to All
                </button>
            </div>
        </div>
    );
}