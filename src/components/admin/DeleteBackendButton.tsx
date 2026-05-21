"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteStorageBackend } from "@/server/actions/storage-actions";

export default function DeleteBackendButton({ backendId }: { backendId: string }) {
    const [isPending, startTransition] = useTransition();
    const handleDelete = () => {
        if (confirm("remove this storage config? photos stored here will no logner be accessible until re-linked")) {
            startTransition(async () => {
                const res = await deleteStorageBackend(backendId);
                if (!res?.success) alert(res?.error || "failed to delete backend");
            });
        }
    };

    return (
        <button onClick={handleDelete} disabled={isPending} className="text-red-500 hover:text-white border border-transparent hover:border-red-500 p-1.5 transition-colors disbaled:opacity-50">
            <Trash2 size={14} />
        </button>
    )
}