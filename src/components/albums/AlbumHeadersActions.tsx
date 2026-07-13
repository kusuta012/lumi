"use client";

import { Edit, Trash2, Download, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteAlbumAction } from "@/server/actions/album-actions";
import EditAlbumModal from "./EditAlbumModal";
import { useRouter } from "next/navigation";
import { useNotification } from "../providers/NotificationProvider";
import Link from "next/link"

export default function AlbumHeadersAction({ album, role }: { album: any, role: string }) {
    const { notify } = useNotification();
    const router = useRouter();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    
    const isOwner = role === 'owner';
    const canManage = role === 'owner' || role === 'co_owner';
    const canContribute = role === 'owner' || role === 'co_owner' || role === 'contributor';

    const handleDelete = () => {
        if (confirm("Delete this album? Photos inside will not be deleted")) {
            startTransition(async () => {
                const res = await deleteAlbumAction(album.id);
                if (res.success) {
                    router.push("/albums");
                    router.refresh();
                } else {
                    notify("error", "Error", "Failed toe delete album")
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
                {canContribute && (
                    <Link href="/photos" className="p-2 hover:bg-orange-500/10 rounded-full text-orange-500 transition-colors" onClick={() => notify("info", "Select Photos in your timeline and click the [+] button to add them here")}>
                        <Plus size={20} />
                    </Link>
                )}
                {canManage && (
                <button onClick={() => setIsEditModalOpen(true)} disabled={isPending} className="p-2 hover:bg-surface-hover rounded-full text-muted hover:text-foreground transition-colors disabled:opacity-50">
                    <Edit size={20} />
                </button>
                )}
                <button onClick={handleDownload} className="p-2 hover:bg-surface-hover rounded-full text-muted hover:text-foreground transition-colors disabled:opacity-50">
                    <Download size={16} /> 
                </button>
                {isOwner && (
                <button onClick={handleDelete} disabled={isPending} className="p-2 hover:bg-red-950/30 rounded-full text-muted hover:text-red-500 transition-colors disabled:opacity-50">
                    <Trash2 size={20} />
                </button>
                )}
            </div>

            {isEditModalOpen && (
                <EditAlbumModal album={album} onClose={() => setIsEditModalOpen(false)} />
            )}
        </>
    );
}