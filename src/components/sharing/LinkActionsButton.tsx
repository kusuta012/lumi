"use client";

import { useState, useTransition } from "react";
import { Copy, Trash2, Check } from "lucide-react";
import { deleteShareLink } from "@/server/actions/share-actions";

export function CopyLink({ token }: { token: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        const url = `${window.location.origin}/s/${token}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button onClick={handleCopy} className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors" title="Copy Link">
            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
        </button>
    );
}

export function DeleteLink({ linkId }: { linkId: string }) {
    const [isPending, startTransition] = useTransition();
    const handleDelete = () => {
        if (confirm("Revoke this share link? Anyone using it will instantly lose access")) {
            startTransition(async () => {
                await deleteShareLink(linkId);
            });
        }
    };

    return (
        <button onClick={handleDelete} disabled={isPending} className="p-2 text-neutral-400 hover:text-red-500 rounded-lg hover:bg-red-950/20 transition-colors disabled:opacity-50">
            <Trash2 size={16} />
        </button>
    );
}