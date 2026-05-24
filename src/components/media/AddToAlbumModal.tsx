"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { X, FolderPlus, Library } from "lucide-react";
import { addToAlbumAction, addMediaToExistingAlbumAction } from "@/server/actions/album-actions";
import { useNotification } from "../providers/NotificationProvider";

interface Props {
    selectedIds: string[];
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddToAlbumModal({ selectedIds, onClose, onSuccess }: Props) {
    const [tab, setTab] = useState<'new' | 'existing'>('new');
    const [existingAlbums, setExistingAlbums] = useState<any[]>([]);
    const [isPending, startTransition] = useTransition();
    const { notify } = useNotification();

    useEffect(() => {
        fetch('/api/albums').then(res => res.json()).then(setExistingAlbums);
    }, []);

    const createWithIds = async (prevState: any, formData: FormData) => {
        const name = formData.get("albumName") as string;
        if (!name) return { success: false,  error: "Name is required" };
        return await addToAlbumAction(selectedIds, name);
    };
    const [state, formAction, isCreating] = useActionState(createWithIds, null);
    useEffect(() => {
        if (state && "success" in state && state.success) {
            onSuccess();
            onClose();
        }
    }, [state, onSuccess, onClose]);

    const handleAddToExisting = (albumId: string) => {
        startTransition(async () => {
            const res = await addMediaToExistingAlbumAction(albumId, selectedIds);
            if (res.success) {
                onSuccess();
                onClose();
            } else {
                notify("error", "Error", `${res.error}`);
            }
        });
    };

    return (
        <div className="fixed inset-0 z-[100] bg-background/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex border-b border-border">
                    <button onClick={() => setTab('new')} className={`flex-1 py-4 text-sm font-bold transition-colors ${tab === 'new' ? 'text-orange-500 border-b-2 border-orange-500 bg-orange-500/5' : 'text-muted hover:text-foreground'}`}>
                        NEW ALBUM
                    </button>
                    <button onClick={() => setTab('existing')} className={`flex-1 py-4 text-sm font-bold transition-colors ${tab === 'existing' ? 'text-orange-500 border-b-2 border-orange-500 bg-orange/500/5' : 'text-muted hover:text-foreground'}`}>
                        EXISTING ALBUM
                    </button>
                </div>
                {tab === 'new' ? (
                    <form action={formAction} className="p-6 space-y-4">
                        <p className="text-xs text-muted">Add {selectedIds.length} items to a new album</p>
                        <input autoFocus name="albumName" placeholder="Album name" className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-orange-500 transition-colors" required />
                        {state?.error && <p className="text-red-500 text-xs">{state.error}</p>}
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-surface-hover text-foreground rounded-lg hover:bg-surface-hover transition-colors text-sm font-medium">Cancel</button>
                            <button type="submit" disabled={isCreating} className="flex-1 px-4 py-2 bg-orange-600 text-foreground rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors text-sm font-medium">
                                {isCreating ? "Creating..." : "Create Album"}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="p-6 space-y-4">
                        <p className="text-xs text-muted">Add {selectedIds.length} items to an existing album</p>
                        <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {existingAlbums.length === 0 ? (
                                <p className="text-muted text-sm py-4 text-center">No albums yet</p>
                            ) : (
                                existingAlbums.map(album => (
                                    <button key={album.id} onClick={() => handleAddToExisting(album.id)} disabled={isPending} className="w-full flex items-center justify-between p-3 bg-background border border-border rounded-xl hover:border-orange-500 transition-colors text-left group">
                                        <span className="text-foreground font-medium truncate pr-4">{album.name}</span>
                                        <Library className="text-muted group-hover:text-orange-500 shrink-0" size={18} />
                                    </button>
                                ))
                            )}
                        </div>
                        <button type="button" onClick={onClose} className="w-full px-4 py-2 bg-surface-hover text-foreground rounded-lg hover:bg-surface-hover transition-colors text-sm font-medium">
                            Cancel
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}