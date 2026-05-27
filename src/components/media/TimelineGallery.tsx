"use client";

import { useState, useTransition, useEffect, useCallback, useRef } from "react";
import Lightbox from "./Lightbox";
import { Check, CheckCircle2, Plus, Share2, Trash2, X, RefreshCcw } from "lucide-react";
import AddToAlbumModal from "./AddToAlbumModal";
import { restoreMediaAction, deletePermanentlyAction, bulkMoveToTrashAction } from "@/server/actions/media-mutations";
import ShareModal from "./ShareModal";
import { useNotification } from "../providers/NotificationProvider";
import { useInView } from "react-intersection-observer";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

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
    duration?: number | null;
}

interface Props {
    initialMedia: MediaItem[];
    startYear: number;
    endYear: number;
    emptyMessage?: string;
    isTrashPage?: boolean;
    isLockedPage?: boolean;
    isSearchPage?: boolean;
    albumId?: string;
    isOwner?: boolean;
    allowDownload?: boolean;
}

function formatDuration(seconds: number | null | undefined): string {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function TimelineGallery({ initialMedia, startYear, endYear, emptyMessage, isTrashPage = false,  isLockedPage = false, isSearchPage = false, albumId, isOwner = true, allowDownload = true }: Props) {
    const { notify } = useNotification();
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showAlbumModal, setShowAlbumModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [isPending, startTransition] = useTransition();
    const isSelectionMode = selectedIds.length > 0;
    const [mediaItems, setMediaItems] = useState<MediaItem[]>(initialMedia);
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [cursor, setCursor] = useState<string | null>(
        initialMedia.length === 50 && !isSearchPage ? new Date(initialMedia[initialMedia.length - 1].dateTaken || initialMedia[initialMedia.length - 1].createdAt).toISOString() : null
    )
    const [hasMore, setHasMore] = useState(initialMedia.length >= 50);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const { ref: loadMoreRef, inView } = useInView({
        rootMargin: '600px',
    });
    

    const loadMorePhotos = useCallback(async () => {
        if (isLoadingMore || !hasMore || isTrashPage || isLockedPage || isSearchPage || albumId || !cursor) return;
        setIsLoadingMore(true);
        try {
            const res = await fetch(`/api/photos/timeline?cursor=${cursor}`);
            if (res.ok) {
                const json = await res.json();
                const newPhotos = json.data.map((m: any) => ({
                    ...m,
                    dateTaken: m.dateTaken ? new Date(m.dateTaken) : null,
                    createdAt: new Date(m.createdAt)
                }));

                setMediaItems(prev => [...prev, ...newPhotos]);
                setCursor(json.nextCursor);
            } else {
                console.error("internal server error, pagination failed");
                setHasMore(false);
            }
        } catch (err) {
            console.error("failed to load more photos");
            setHasMore(false);
        } finally {
            setIsLoadingMore(false);
        }
    }, [cursor, hasMore, isLoadingMore, isTrashPage, isLockedPage, albumId]);

    useEffect(() => {
        if (inView) {
            loadMorePhotos();
        }
    }, [inView, loadMorePhotos]);

    useEffect(() => {
        if (
            selectedIndex !== null &&
            selectedIndex >= mediaItems.length - 5 &&
            hasMore &&
            !isLoadingMore
        ) {
            loadMorePhotos();
        }
    }, [selectedIndex, mediaItems.length, hasMore, isLoadingMore, loadMorePhotos]);

    useEffect(() => {
        setMediaItems(initialMedia);
        setCursor(initialMedia.length >= 50 && !isSearchPage ? new Date(initialMedia[initialMedia.length - 1].dateTaken || initialMedia[initialMedia.length - 1].createdAt).toISOString() : null);
        setHasMore(initialMedia.length >= 50 && !isSearchPage);
    }, [initialMedia, isSearchPage]);

    const groupedMedia = mediaItems.reduce<Record<string, MediaItem[]>>((acc, item) => {
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

    const listRef = useRef<HTMLDivElement>(null);
    const virtualizer = useWindowVirtualizer({
        count: sortedGroups.length,
        estimateSize: () => 400,
        overscan: 3,
    })

    const toggleSelect = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const isDateGroupAllSelected = (items: MediaItem[]) => {
        return items.every(item => selectedIds.includes(item.id));
    };

    const toggleSelectDateGroup = (items: MediaItem[], e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        const allSelected = isDateGroupAllSelected(items);
        const groupIds = items.map(item => item.id);

        if (allSelected) {
            setSelectedIds(prev => prev.filter(id => !groupIds.includes(id)));
        } else {
            setSelectedIds(prev => [...new Set([...prev, ...groupIds])]);
        }
    };

    const clearSelection = () => setSelectedIds([]);
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
        <div className="p-6 pb-24 relative" ref={listRef}>
            {isSelectionMode && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[2000] flex items-center gap-6 px-6 py-3 bg-surface border border-border rounded-full shadow-2xl animate-in slide-in-from-top duration-300">
                    <div className="flex items-center gap-3 pr-4 border-r border-border">
                        <button onClick={clearSelection} className="p-1 hover:bg-surface-hover rounded-full transition-colors">
                            <X size={18} className="text-muted" />
                        </button>
                        <span className="text-sm font-bold text-foreground">{selectedIds.length} selected</span>
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
                            <button onClick={() => setShowAlbumModal(true)} className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-orange-500 transition-colors">
                            <Plus size={18} />
                        </button>
                        <button onClick={() => setShowShareModal(true)} className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground transition-colors">
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
                <div className="flex flex-col items-center justify-center h-64 text-muted">
                    <p>{emptyMessage}</p>
                </div>
            ) : (
                <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative'}}>
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                        const [date, items] = sortedGroups[virtualRow.index];
                        const isAllSelected = isDateGroupAllSelected(items);
                        return (
                            <div key={date} data-index={virtualRow.index} ref={virtualizer.measureElement} className="absolute top-0 left-0 w-full pb-12" style={{ transform: `translateY(${virtualRow.start}px)` }}>
                            <div className="flex items-center gap-2 mb-4 sticky top-0 py-2 bg-background/80 backdrop-blur-md z-10 group/date">
                            <button onClick={(e) => toggleSelectDateGroup(items, e)} className={`transition-all duration-200 active:scale-90 ${isAllSelected ? 'opacity-100 text-orange-500' : 'opacity-0 group-hover/date:opacity-100 text-muted hover:text-foreground'}`}>
                                <CheckCircle2 size={18} />
                            </button>
                            <h2 className="text-sm font-semibold text-foreground">{date}</h2>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
                                {items.map((item) => {
                                    const isSelected = selectedIds.includes(item.id);
                                    const isVideo = item.mimetype.startsWith("video/");
                                    const isHovered = hoveredId === item.id;
                                    const imageSrc = (isVideo && isHovered) ? `/api/media/${item.id}?size=sprite` : `/api/media/${item.id}?size=small`;
                                    return(
                                        <div key={item.id} onClick={() => isSelectionMode ? toggleSelect(item.id) : setSelectedIndex(mediaItems.indexOf(item))} onMouseEnter={() => isVideo && setHoveredId(item.id)} onMouseLeave={() => isVideo && setHoveredId(null)} className={`relative group aspect-square bg-surface overflow-hidden cursor-pointer transition-all duration-300 ${ isSelected ? 'ring-4 ring-orange-500 ring-inset' : 'hover:ring-2 ring-orange-500'}`}>
                                        <img src={imageSrc} alt={item.filename} className={`w-full h-full object-cover transition-transform duration-500 ${isSelected ? 'scale-90 opacity-80' : 'group-hover:scale-110'}`} loading="lazy" />
                                        
                                        {isVideo && !isHovered && (
                                            <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-background/60 backdrop-blur-md rounded border border-white/10 text-[10px] font-bold text-foreground flex items-center gap-1 shadow">
                                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                                {item.duration ? formatDuration(item.duration) : "VIDEO"}
                                            </div>
                                        )}

                                        <button onClick={(e) => toggleSelect(item.id, e)} className={`absolute top-2 left-2 z-20 transition-all duration-200 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                        <div className={`rounded-full p-0.5 ${isSelected ? 'bg-orange-500 text-foreground' : 'bg-background/40 text-foreground/70 backdrop-blur-md border border-white/20'}`}>
                                            <CheckCircle2 size={20} />
                                        </div>
                                        </button>
                                        <div className="absolute inset-0 bg-background/0 group-hover:bg-background/10 transition-all duration-200" />
                                    </div>
                                    );
                                })}
                            </div>
                        </div>
                        );
                    })}
                </div>
            )}

            {cursor && !isTrashPage && !isLockedPage && !isSearchPage && !albumId && (
                <div ref={loadMoreRef} className="h-20 w-full flex items-center justify-center mt-8">
                    <span className="text-xs text-muted animate-pulse font-bold tracking-widest">
                        Loading More...
                    </span>
                </div>
            )}

            <div className="fixed right-4 top-24 bottom-12 w-6 hidden xl:flex flex-col items-center justify-between py-4 text-[11px] text-muted font-bold z-10 pointer-events-none">
                <span>{startYear}</span>
                <div className="flex-1 w-[1px] bg-surface-hover my-4 relative">
                    <div className="absolute top-[25%] w-1.5 h-1.5 rounded-full bg-surface-hover -left-[2.5px]"></div>
                    <div className="absolute top-[50%] w-1.5 h-1.5 rounded-full bg-surface-hover -left-[2.5px]"></div>
                    <div className="absolute top-[75%] w-1.5 h-1.5 rounded-full bg-surface-hover -left-[2.5px]"></div>
                </div>
                <span>{endYear}</span>
            </div>
            {selectedIndex !== null && (
                <Lightbox items={mediaItems} index={selectedIndex} setIndex={(i: number) => setSelectedIndex(i)} onClose={() => setSelectedIndex(null)} albumId={albumId} isOwner={isOwner} allowDownload={allowDownload} />
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