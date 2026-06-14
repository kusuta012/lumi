"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { MoreVertical, Edit2, Share2, Download, Trash2, Library, Trash } from "lucide-react";
import { deleteAlbumAction } from "@/server/actions/album-actions";
import EditAlbumModal from "./EditAlbumModal";
import { useRouter } from "next/navigation";
import ShareModal from "../media/ShareModal";
import { useNotification } from "../providers/NotificationProvider";
import { useSession } from "next-auth/react";

export default function AlbumCard({ album, role }: { album: any, role: string }) {
    const router = useRouter();
    const { data: session } = useSession();
    const isOwner = role === 'owner';
    const canManage = role === 'owner' || role === 'co_owner';
    const [menuOpen, setMenuOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const menuRef = useRef<HTMLDivElement>(null);
    const { notify } = useNotification();

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuOpen(false);

        if (confirm(`Delete album "${album.name}"? The photos inside will not be deleted`)) {
            startTransition(async () => {
                const res = await deleteAlbumAction(album.id);
                if (res && res.success === true) {
                    router.refresh();
                } else {
                    notify("error", "Error", "Failed to delete album");
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
            <div className="relative group">
                <Link href={`/albums/${album.id}`} className="block">
                    <div className="aspect-square bg-surface rounded-2xl overflow-hidden mb-3 relative border border-border shadow-lg group-hover:border-orange-500/50 transition-all">
                        {album.coverMediaId ? (
                            <img src={`/api/media/${album.coverMediaId}?size=medium`} alt={album.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted">
                                <Library size={40} />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-background/10 opacity-60 group-hover:opacity-80 transition-opacity" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground group-hover:text-orange-500 transition-colors truncate pr-8">{album.name}</h3>
                    {album.description && (
                        <p className="text-xs text-muted mt-0.5 truncate">{album.description}</p>
                    )}
                </Link>
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(!menuOpen); }} className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md border-transition-all z-10 ${menuOpen? 'bg-surface-hover border-border opacity-100 text-foreground' : 'bg-background/40 border-white/10 text-foreground/80 opacity-0 group-hover:opacity-100 hover:bg-background/60 hover:text-foreground'}`}>
                    <MoreVertical size={18} />
                </button>
                {menuOpen && (
                    <div ref={menuRef} className="absolute top-12 right-2 w-48 bg-surface border border-border rounded-lg shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                        {canManage && (
                            <>
                                <button onClick={(e) => { e.stopPropagation(); setIsEditModalOpen(true); setMenuOpen(false); }} className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-foreground hover:bg-surface-hover hover:text-foreground transition-colors">
                                    <Edit2 size={16} /> Edit Album
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setIsShareModalOpen(true); setMenuOpen(false); }} className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-foreground hover:bg-surface-hover hover:text-foreground transition-colors">
                                    <Share2 size={16} /> Share
                                </button>
                            </>
                        )}
                                <button onClick={handleDownload} className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-foreground hover:bg-surface-hover hover:text-foreground transition-colors">
                                    <Download size={16} /> Download
                                </button>
                            {isOwner && (
                                <>
                                    <div className="h-px bg-surface-hover my-1 w-full" />
                                    <button onClick={handleDelete} disabled={isPending} className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-red-400 hover:bg-red-950/50 hover:text-red-300 transition-colors">
                                        <Trash2 size={16} /> Delete
                                    </button>
                                </>
                            )}
                    </div>
                )}
            </div>
            {isEditModalOpen && (
                <EditAlbumModal album={album} onClose={() => setIsEditModalOpen(false)} />
            )}
            {isShareModalOpen && (
                <ShareModal targetId={album.id} type="album" onClose={() => setIsShareModalOpen(false)} currentRole={role} />
            )}
        </>
    );

}