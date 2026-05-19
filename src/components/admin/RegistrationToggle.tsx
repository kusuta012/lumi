"use client";

import { useTransition } from "react";
import { toggleRegistrationAction } from "@/server/actions/config-actions";

export default function RegistrationToggle({  isEnabled }: { isEnabled: boolean }) {
    const [isPending, startTransition] = useTransition();
    const handleToggle = () => {
        startTransition(async () => {
            await toggleRegistrationAction(isEnabled)
        });
    };

    return (
        <div className="flex items-center justify-between p-3 border border-neutral-700 bg-[#111]">
            <div>
                <span className="text-white font-bold text-sm block">Open registration</span>
                <span className="text-neutral-500 text-[10px]">
                    {isEnabled ? "Public signups allowed" : "Invite Only"}
                </span>
            </div>
            <button onClick={handleToggle} disabled={isPending} className={`px-4 py-1.5 text-xs font-bold border transition-none disabled:opacity-50 ${isEnabled ? 'border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black' : 'border-neutral-500 text-neutral-500 hover:border-white hover:text-white'}`}>
                {isEnabled ? "Enabled" : "Disabled"}
            </button>
        </div>
    );
}