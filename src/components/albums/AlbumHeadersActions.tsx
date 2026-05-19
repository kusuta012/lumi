"use client";

import { Edit, Trash2, Download } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteAlbumAction } from "@/server/actions/album-actions";
import EditAlbumModal from "./EditAlbumModal";
import { useRouter } from "next/navigation";

export default function AlbumHeadersAction({ album }: { album: any }) {
    const router = useRouter();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const handleDelete = () => {
        if (confirm("Delete this album? Photos inside will not be deleted")) {
            startTransition(async () => {
                const res = await deleteAlbumAction(album.id);
                if (res.success) {
                    router.push("/albums");
                    router.refresh();
                } else {
                    alert(res.error || "Failed toe delete album")
                }
            });
        }
    };

    const handleDownload = (e: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        window.location.href = `/api/albums/${album.id}/download`;
    };

    return (
        <>
            <div className="flex items-center gap-2 pb-1">
                <button onClick={() => setIsEditModalOpen(true)} disabled={isPending} className="p-2 hover:bg-neutral-800 rounded-full text-neutral-400 hover:text-white transition-colors disabled:opacity-50">
                    <Edit size={20} />
                </button>
                <button onClick={handleDownload} className="p-2 hover:bg-neutral-800 rounded-full text-neutral-400 hover:text-white transition-colors disabled:opacity-50">
                    <Download size={16} /> 
                </button>
                <button onClick={handleDelete} disabled={isPending} className="p-2 hover:bg-red-950/30 rounded-full text-neutral-400 hover:text-red-500 transition-colors disabled:opacity-50">
                    <Trash2 size={20} />
                </button>
            </div>

            {isEditModalOpen && (
                <EditAlbumModal album={album} onClose={() => setIsEditModalOpen(false)} />
            )}
        </>
    );
}