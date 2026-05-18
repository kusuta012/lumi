"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { X, FolderPlus } from "lucide-react";
import { addToAlbumAction } from "@/server/actions/album-actions";

interface Props {
    selectedIds: string[];
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddToAlbumModal({ selectedIds, onClose, onSuccess }: Props) {
    const createWithIds = async (prevState: any, formData: FormData) => {
        const name = formData.get("albumName") as string;
        if (!name) return { error: "Name is required" };

        const result = await addToAlbumAction(selectedIds, name);
        return result;
    };

    const [state, formAction, isPending] = useActionState(createWithIds, null);
    useEffect(() => {
        if (state?.success) {
            onSuccess();
            onClose();
        }
    }, [state, onSuccess, onClose]);

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-neutral-800 flex justify-between items-center">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <FolderPlus className="text-orange-500 w-5 h-5" />
                        Create New Album
                    </h3>
                    <button type="button" onClick={onClose} className="text-neutral-500 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <form action={formAction} className="p-6 space-y-4">
                    <p className="text-xs text-neutral-400">
                        Add {selectedIds.length} items to a new album.
                    </p>

                    <input autoFocus name="albumName" placeholder="Album name" className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-orange-500 transition-colors" required />
                    {state?.error && (
                        <p className="text-red-500 text-xs">{state.error}</p>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700 transition-colors text-sm font-medium">
                            Cancel
                        </button>
                        <button type="submit" disabled={isPending} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transtion-colors text-sm font-medium">
                            {isPending ? "Creating..." : "Create Album"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}