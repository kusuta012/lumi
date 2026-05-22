"use client";

import { useState, useTransition } from "react";
import Lightbox from "./Lightbox";
import { Check, CheckCircle2, Plus, Share2, Trash2, X, RefreshCcw } from "lucide-react";
import AddToAlbumModal from "./AddToAlbumModal";
import { restoreMediaAction, deletePermanentlyAction, bulkMoveToTrashAction } from "@/server/actions/media-mutations";
import shareModal from './ShareModal';
import ShareModal from "./ShareModal";

interface MediaItem {
    id: string,
    filename: string;
    dateTaken: Date | null;
    createdAt: Date;
    isFavorited: boolean | null;
    isArchived: boolean | null;
    isDeleted: boolean | null;
    mimetype: string;
    size: number;
    width: number | null;
    height: number | null;
}

interface Props {
    initialMedia: MediaItem[];
    startYear: number;
    endYear: number;
    emptyMessage?: string;
    isTrashPage?: boolean;
    albumId?: string;
    isOwner?: boolean;
    allowDownload?: boolean;
    isLockedPage?: boolean;

}

export default function TimelineGallery({ initialMedia, startYear, endYear, emptyMessage, isTrashPage = false, albumId, isOwner = true, allowDownload = true }: Props) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showAlbumModal, setShowAlbumModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const isSelectionMode = selectedIds.length > 0;

    const groupedMedia = initialMedia.reduce<Record<string, MediaItem[]>>((acc, item) => {
        const d = item.dateTaken ? new Date(item.dateTaken) : new Date(item.createdAt);
        const dateKey = d.toLocaleDateString('en-US', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
        });
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(item);
        return acc;
    }, {});

    const sortedGroups = Object.entries(groupedMedia).sort((a, b) => {
        const timeA = new Date(a[1][0].dateTaken || a[1][0].createdAt).getTime();
        const timeB = new Date(b[1][0].dateTaken || b[1][0].createdAt).getTime();
        return timeB -timeA;
    });

    const toggleSelect = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const clearSelection = () => setSelectedIds([]);
    const [isPending, startTransition] = useTransition();
    const handleRestore = () => {
        if (!confirm(`Restore ${selectedIds.length} items?`)) return;
        startTransition(async () => {
            await restoreMediaAction(selectedIds);
            clearSelection();
        });
    };
    const handleDeletePermanently = () => {
        if (!confirm(`Permanently delete ${selectedIds.length} items? This annot be undone`)) return;
        startTransition(async () => {
            await deletePermanentlyAction(selectedIds);
            clearSelection();
        });
    };

    const handleBulkTrash = () => {
        startTransition(async () => {
            await bulkMoveToTrashAction(selectedIds);
            clearSelection();
        });
    };

    return(
        <div className="p-6 pb-24 relative">
            {isSelectionMode && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-6 px-6 py-3 bg-neutral-900 border border-neutral-800 rounded-full shadow-2xl animate-in slide-in-from-top duration-300">
                    <div className="flex items-center gap-3 pr-4 border-r border-neutral-800">
                        <button onClick={clearSelection} className="p-1 hover:bg-neutral-800 rounded-full transition-colors">
                            <X size={18} className="text-neutral-400" />
                        </button>
                        <span className="text-sm font-bold text-white">{selectedIds.length} selected</span>
                    </div>
                    <div className="flex items-center gap-5">
                        {isTrashPage ? (
                            <>
                                <button onClick={handleRestore} disabled={isPending} className="flex items-center gap-2 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
                                    <RefreshCcw size={18} /> Restore
                                </button>
                                <button onClick={handleDeletePermanently} disabled={isPending} className="flex items-center gap-2 text-sm font-medium text-red-500 hover:text-red-400 transition-colors">
                                    <Trash2 size={18} /> Delete forever
                                </button>
                            </>
                        ) : (
                            <>
                            <button onClick={() => setShowAlbumModal(true)} className="flex items-center gap-2 text-sm font-medium text-neutral-300 hover:text-orange-500 transition-colors">
                            <Plus size={18} />
                        </button>
                        <button onClick={() => setShowShareModal(true)} className="flex items-center gap-2 text-sm font-medium text-neutral-300 hover:text-white transition-colors">
                            <Share2 size={18} />
                        </button>
                        <button onClick={handleBulkTrash} disabled={isPending} className="flex items-center gap-2 text-sm font-medium text-red-400 hover:text-red-300 transition-colors">
                            <Trash2 size={18} />
                        </button> 
                            </>
                        )}  
                    </div>
                </div>
            )}

            {initialMedia.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
                    <p>{emptyMessage}</p>
                </div>
            ) : (
                <div className="space-y-12">
                    {sortedGroups.map(([date, items]) => (
                        <div key={date}>
                            <h2 className="text-sm font-semibold text-neutral-300 mb-4 sticky top-0 py-2 bg-[#0a0a0a]/80 backdrop-blur-md z-10">{date}</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
                                {items.map((item) => {
                                    const isSelected = selectedIds.includes(item.id);
                                    return(
                                        <div key={item.id} onClick={() => isSelectionMode ? toggleSelect(item.id) : setSelectedIndex(initialMedia.indexOf(item))} className={`relative group aspect-square bg-neutral-900 overflow-hidden cursor-pointer transition-all duration-300 ${ isSelected ? 'ring-4 ring-orange-500 ring-inset' : 'hover:ring-2 ring-orange-500'}`}>
                                        <img src={`/api/media/${item.id}?size=small`} alt={item.filename} className={`w-full h-full object-cover transition-transform duration-500 ${isSelected ? 'scale-90 opacity-80' : 'group-hover:scale-110'}`} loading="lazy" />
                                        <button onClick={(e) => toggleSelect(item.id, e)} className={`absolute top-2 left-2 z-20 transition-opactiy duration-200 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                        <div className={`rounded-full p-0.5 ${isSelected ? 'bg-orange-500 text-white' : 'bg-black/40 text-white/70 backdrop-blur-md border border-white/20'}`}>
                                            <CheckCircle2 size={20} />
                                        </div>
                                        </button>
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-200" />
                                    </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="fixed right-4 top-24 bottom-12 w-6 hidden xl:flex flex-col items-center justify-between py-4 text-[11px] text-neutral-500 font-bold z-10 pointer-events-none">
                <span>{startYear}</span>
                <div className="flex-1 w-[1px] bg-neutral-800 my-4 relative">
                    <div className="absolute top-[25%] w-1.5 h-1.5 rounded-full bg-neutral-700 -left-[2.5px]"></div>
                    <div className="absolute top-[50%] w-1.5 h-1.5 rounded-full bg-neutral-700 -left-[2.5px]"></div>
                    <div className="absolute top-[75%] w-1.5 h-1.5 rounded-full bg-neutral-700 -left-[2.5px]"></div>
                </div>
                <span>{endYear}</span>
            </div>
            {selectedIndex !== null && (
                <Lightbox items={initialMedia} index={selectedIndex} setIndex={(i: number) => setSelectedIndex(i)} onClose={() => setSelectedIndex(null)} albumId={albumId} isOwner={isOwner} allowDownload={allowDownload} />
            )}

            {showAlbumModal && (
                <AddToAlbumModal selectedIds={selectedIds} onClose={() => setShowAlbumModal(false)} onSuccess={() => { clearSelection(); }} />
            )}
            {showShareModal && (
                <ShareModal selectedIds={selectedIds} type="media" onClose={() => setShowShareModal(false)} onSuccess={() => { clearSelection(); }} />
            )}
        </div>
    );
}