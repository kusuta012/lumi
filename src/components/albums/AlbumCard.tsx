"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { MoreVertical, Edit2, Share2, Download, Trash2, Library, Trash } from "lucide-react";
import { deleteAlbumAction } from "@/server/actions/album-actions";
import EditAlbumModal from "./EditAlbumModal";
import { useRouter } from "next/navigation";
import ShareModal from "../media/ShareModal";
import { useNotification } from "../providers/NotificationProvider";

export default function AlbumCard({ album }: { album: any }) {
    const router = useRouter();
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
                    <div className="aspect-square bg-neutral-900 rounded-2xl overflow-hidden mb-3 relative border border-neutral-800 shadow-lg group-hover:border-orange-500/50 transition-all">
                        {album.coverMediaId ? (
                            <img src={`/api/media/${album.coverMediaId}?size=medium`} alt={album.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-700">
                                <Library size={40} />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10 opacity-60 group-hover:opacity-80 transition-opacity" />
                    </div>
                    <h3 className="text-sm font-bold text-neutral-200 group-hover:text-orange-500 transition-colors truncate pr-8">{album.name}</h3>
                    {album.description && (
                        <p className="text-xs text-neutral-400 mt-0.5 truncate">{album.description}</p>
                    )}
                </Link>
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(!menuOpen); }} className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md border-transition-all z-10 ${menuOpen? 'bg-neutral-800 border-neutral-600 opacity-100 text-white' : 'bg-black/40 border-white/10 text-white/80 opacity-0 group-hover:opacity-100 hover:bg-black/60 hover:text-white'}`}>
                    <MoreVertical size={18} />
                </button>
                {menuOpen && (
                    <div ref={menuRef} className="absolute top-12 right-2 w-48 bg-[#1f1f1f] border border-neutral-700 rounded-lg shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                        <button onClick={(e) => { e.stopPropagation(); setIsEditModalOpen(true); setMenuOpen(false); }} className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-neutral-200 hover:bg-neutral-800 hover:text-white transition-colors">
                            <Edit2 size={16} /> Edit Album
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setIsShareModalOpen(true); setMenuOpen(false); }} className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-neutral-200 hover:bg-neutral-800 hover:text-white transition-colors">
                            <Share2 size={16} /> Share
                        </button>
                        <button onClick={handleDownload} className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-neutral-200 hover:bg-neutral-800 hover:text-white transition-colors">
                            <Download size={16} /> Download
                        </button>
                        <div className="h-px bg-neutral-800 my-1 w-full" />
                            <button onClick={handleDelete} disabled={isPending} className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-red-400 hover:bg-red-950/50 hover:text-red-300 transition-colors">
                                <Trash2 size={16} /> Delete
                            </button>
                    </div>
                )}
            </div>
            {isEditModalOpen && (
                <EditAlbumModal album={album} onClose={() => setIsEditModalOpen(false)} />
            )}
            {isShareModalOpen && (
                <ShareModal targetId={album.id} type="album" onClose={() => setIsShareModalOpen(false)} />
            )}
        </>
    );

}