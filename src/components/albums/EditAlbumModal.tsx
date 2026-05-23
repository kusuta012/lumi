"use client";

import { X, Edit2, ImagePlus, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { updateAlbumAction, uploadNewCoverAction } from "@/server/actions/album-actions";
import { useNotification } from "../providers/NotificationProvider";

export default function EditAlbumModal({ album, onClose }: {album: any, onClose: () => void }) {
    const [name , setName] = useState(album.name || "");
    const [description, setDescription] = useState(album.description || "")
    const [isPending, startTransition] = useTransition();
    const [isUploading, setIsUploading] = useState(false);
    const { notify } = useNotification();

    const handleSave = () => {
        if (!name.trim()) return;
        startTransition(async () => {
            const res = await updateAlbumAction(album.id, { name: name.trim(), description: description.trim() });
            if (res.success) onClose();
            else notify("error", "Error", `${res.error}`);
        });
    };

    const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const res = await fetch("/api/upload/presigned", {
                method: "POST",
                headers: { "Content-Type": "applications/json" },
                body: JSON.stringify({ filename: file.name, contentType: file.type }),
            });
            if (!res.ok) throw new Error("failed to get upload url");
            const { presignedUrl, objectKey } = await res.json();
            const uploadRes = await fetch(presignedUrl, {
                method: "PUT",
                body: file,
                headers: { "Content-Type": file.type },
            });
            if(!uploadRes.ok) throw new Error("minio upload failed");
            const actionRes = await uploadNewCoverAction(album.id, {
                filename: file.name,
                mimetype: file.type,
                size: file.size,
                objectKey
            });
            if (!actionRes.success) throw new Error(actionRes.error);
        } catch (err) {
            console.error(err);
            notify("error", "Error", "failed to upload new cover");
        } finally {
            setIsUploading(false);
            e.target.value = "";
        }
    };

    return (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-[#1a1a1a] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-neutral-800 flex justify-between items-center">
                    <h2 className="text-white font-bold text-lg flex items-center gap-2">
                        <Edit2 size={18} className="text-orange-500" /> Edit album
                    </h2>
                    <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 flex flex-col md:flex-row gap-8">
                    <label className="shrink-0 group relative w-48 h-48 rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 cursor-pointer">
                        <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={isUploading} />
                        {album.coverMediaId ? (
                            <img src={`/api/media/${album.coverMediaId}?size=medium`} 
                            className="w-full h-full object-cover"
                            alt="Cover" />
                        ) : (
                            <div className="w-full h-full items-center justify-center text-neutral-600">No cover</div>
                        )}
                        
                        <div className={`absolute inset-0 transition-all flex flex-col items-center justify-center text-white gap-2 ${isUploading ? 'bg-black/80 opacity-100' : 'bg-black/40 opacity-0 group-hover:opacity-100'}`}>
                            {isUploading ? (
                                <>
                                    <Loader2 size={24} className="animate-spin text-orange-500" />
                                    <span className="text-xs font-medium">Uploading...</span>
                                </>
                            ) : (
                                <>
                                    <ImagePlus size={24} />
                                    <span className="text-xs font-medium">Change Cover</span>
                                </>
                            )}
                        </div>
                    </label>
                    <div className="flex-1 space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-1.5">Name</label>
                            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-[#242424] border border-neutral-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors" placeholder="Album Name" autoFocus />
                        </div>
                    <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1.5">Description</label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full bg-[#242424] border border-neutral-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors resize-none" placeholder="Add a description" />
                </div>
            </div>
        </div>

        <div className="px-6 py-5 bg-[#141414] border-t border-neutral-800 flex gap-4">
            <button onClick={onClose} className="flex-1 py-2.5 bg-neutral-800 text-white font-medium rounded-xl hover:bg-neutral-700 transition-colors">
                Cancel
            </button>
            <button onClick={handleSave} disabled={isPending || !name.trim()} className="flex-1 py-2.5 bg-orange-600 text-white font-medium rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50">
                {isPending ? "Saving.." : "Save"}
            </button>
        </div>
    </div>
</div>
    );
}