"use client";

import { useTransition } from "react";
import { setDefaultBackend } from "@/server/actions/storage-actions";

export default function setDefaultButton({ backendId }: { backendId: string }) {
    const [isPending, startTransition] = useTransition();
    const handleSetDefault = () => {
        startTransition(async () => {
            await setDefaultBackend(backendId);
        });
    };

    return (
        <button onClick={handleSetDefault} disabled={isPending} className="text-[10px] font-bold text-neutral-400 hover:text-white border border-neutral-700 hover:border-white px-2 py-1 transition-colors disabled:opacity-50">
            {isPending ? "SETTING.." : "SET DEFAULT" }
        </button>
    );
}