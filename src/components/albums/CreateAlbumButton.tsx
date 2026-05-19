"use client";

import { Plus } from "lucide-react";
import { createEmptyAlbumAction } from "@/server/actions/album-actions";
import { useTransition } from "react";

export default function CreateAlbumButton() {
    const [isPending, startTransition] = useTransition();
    const handleCreate = () => {
        const name = prompt("Enter album name:");
        if (name && name.trim()) {
            startTransition(async () => {
                const res = await createEmptyAlbumAction(name.trim());
                if (!res.success) alert(res.error);
            });
        }
    };

    return (
        <button onClick={handleCreate} disabled={isPending} className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-orange-950/20">
            <Plus size={18} />
            {isPending ? "Creating.." : "New Album"}
        </button>
    );
}