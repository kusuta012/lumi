"use client";

import { X, ImageIcon, Calendar, Camera, MapPin, FileText, Heart, Tag, Loader2, Trash2, Info, Lock, Unlock, ChevronLeft, ChevronRight, Download, Copy, Maximize2, Share2, SlidersHorizontal, MoreVertical, RefreshCcw, Archive, Icon, Edit2, Video, Type, Edit } from "lucide-react";
import { format } from "date-fns";
import { useTransition, useState, useEffect } from "react";
import { toggleFavoriteAction, toggleArchiveAction, toggleTrashAction, restoreMediaAction, deletePermanentlyAction, getTags, addTags, removeTag, updateMediaMetadata } from "@/server/actions/media-mutations";
import { updateAlbumAction } from "@/server/actions/album-actions";
import { moveToLockedFolder } from "@/server/actions/locked-actions";
import { restoreFromLockedFolder } from "@/server/actions/locked-actions";
import { useRouter } from "next/navigation";
import ShareModal from "./ShareModal";
import { useNotification } from "../providers/NotificationProvider";
import TagModal from "./TagModal";
import HLSPlayer from "./HLSPlayer";


interface LightboxProps {
    items: any[];
    index: number;
    setIndex: (i: number) => void;
    onClose: () => void;
    albumId?: string;
    isOwner?: boolean;
    allowDownload?: boolean;
}

export default function Lightbox({ items, index, setIndex, onClose, albumId, isOwner = true, allowDownload = true }: LightboxProps) {
    const item = items[index];
    const { notify } = useNotification();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [showInfo, setShowInfo] = useState(false);
    const [isFav, setIsFav] = useState(item?.isFavorited ?? false);
    const [isArchived, setIsArchived] = useState(item?.isArchived ?? false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isTagModalOpen, setIsTagModalOpen] = useState(false);
    const [tagsList, setTagsList] = useState<{ id: string; name: string }[]>([]);
    const [newTagName, setNewTagName] = useState("");
    const [isLoadingTags, setLoadingTags] = useState(false);

    useEffect(() => {
        if (!item) {
            onClose();
            return;
        }
        setIsFav(item.isFavorited);
        setIsArchived(item.isArchived);
    }, [item, onClose]);

    useEffect(() => {
        if (!showInfo || !item?.id) return;
        setLoadingTags(true);
        getTags(item.id).then(res => {
            if (res.success && res.tags) {
                setTagsList(res.tags);
            }
            setLoadingTags(false);
        });
    }, [item?.id, showInfo]);

    const goNext = () => index < items.length - 1 && setIndex(index + 1);
    const goPrev = () => index > 0 && setIndex(index - 1);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight") goNext();
            if (e.key === "ArrowLeft") goPrev();
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [index, items.length]);

    const handleAction = (type: 'fav' | 'archive' | 'trash') => {
        startTransition(async () => {
            if (type === 'fav') {
                setIsFav(!isFav);
                await toggleFavoriteAction(item.id, isFav);
            } else if (type === 'archive') {
                setIsArchived(!isArchived);
                await toggleArchiveAction(item.id, isArchived);
            } else {
                await toggleTrashAction(item.id, item.isDeleted);
                onClose();
            }
            router.refresh();
        });
    };
    
    const handleSetCover = () => {
        if (!albumId) return;
        startTransition(async () => {
            const res = await updateAlbumAction(albumId, { coverMediaId: item.id });
            if(res.success) {
                notify("info", "Updated", 'Album cover was updated');
            }
        });
    }

    const handleDownload = async () => {
        const res = await fetch(`/api/media/${item.id}?size=original`);
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = item.filename;
        a.click();
    };

    const handleCopy = async () => {
        try {
            const res = await fetch(`/api/media/${item.id}`);
            const webpBlob = await res.blob();
            const imageUrl = URL.createObjectURL(webpBlob);

            const img = new Image();
            img.src = imageUrl;
            img.onload = async () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                if (!ctx) return;
                ctx.drawImage(img, 0, 0);

                canvas.toBlob(async (pngBlob) => {
                    if (!pngBlob) return;
                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({ "image/png": pngBlob })
                        ]);
                        notify("success", "Copied", "Image copied to clipboard");
                    } catch (e) {
                        console.error("clipboard write failed", e);
                        notify("error", "Failed", "Failed to Copy to clipboard");
                    } finally {
                        URL.revokeObjectURL(imageUrl);
                    }
                }, "image/png");
            };
        } catch (e) {
            console.error("Copy process failed", e);
            notify("error", "Error", "Failed to processs image");
        }
    };

    const handleRestore = () => {
        startTransition(async () => {
            await restoreMediaAction([item.id]);
            onClose();
            router.refresh();
        });
    };

    const handlePermanentDelete = () => {
        if (confirm("Permanently delete this item? This cannot be undone.")) {
            startTransition(async () => {
                await deletePermanentlyAction([item.id]);
                onClose();
                router.refresh();
            });
        }
    };

    const handleLock = () => {
        const confirmed = confirm("Move this item to the locked folder? It will be remove from all albums");
        if (!confirmed) return;

        startTransition(async () => {
            await moveToLockedFolder([item.id]);
            onClose();
            router.refresh();
        });
    };

    const handleUnlock = () => {
        startTransition(async () => {
            await restoreFromLockedFolder([item.id]);
            onClose();
            router.refresh();
        });
    };

    const handleAddTag = async (e: React.SyntheticEvent) => {
        e.preventDefault();
        const tName = newTagName.trim();
        if (!tName || tagsList.length >= 5) return;

        const res = await addTags(item.id, tName);
        if (res.success && res.tag) {
            setTagsList(prev => [...prev, res.tag!]);
            setNewTagName("");
            notify("success", "Added", `Tag #${tName} added`)
        } else {
            notify("error", "Error", res.error || "failed to add tag");
        }
    }; 

    const handleRemoveTag = async (tagId: string, tagName: string) => {
        const res = await removeTag(item.id, tagId);
        if (res.success) {
            setTagsList(prev => prev.filter(t => t.id !== tagId));
            notify("success", "Removed", `Tag #${tagName} removed`);
        } else {
            notify("error", "Error", "Failed to remove tag");
        }
    };

    if (!item) return null;
    return (
        <div className="fixed inset-0 z-[999999] bg-background flex overflow-hidden animate-in fade-in duration-200">
            <div className="flex-1 relative flex flex-col h-full overflow-hidden">
                <div className="h-16 flex items-center justify-between px-4 bg-gradient-to-b from-black/70 to-transparent absolute top-0 w-full z-20">
                    <button onClick={onClose} className="p-2 text-foreground/80 hover:text-foreground transition-colors">
                        <X size={24} />
                    </button>

                    <div className="flex items-center gap-1 sm:gap-2">
                        
                        <IconButton icon={<Maximize2 size={20} />} onClick={() => document.documentElement.requestFullscreen()} />
                        <IconButton icon={<Copy size={20} />} onClick={handleCopy} />
                        {allowDownload && (
                            <IconButton icon={<Download size={20} />} onClick={handleDownload} />
                        )}
                        <IconButton icon={<Info size={20} />} onClick={() => setShowInfo(!showInfo)} active={showInfo} />
                        {isOwner && !item.isDeleted && (
                            <IconButton icon={<Share2 size={20} />} onClick={() => setIsShareModalOpen(true)} />
                        )}
                        {isOwner && (
                            <>
                            {albumId && !item.isDeleted && (
                            <IconButton icon={<ImageIcon size={20} />}
                            onClick={handleSetCover}
                            disabled={isPending}
                            title="Set as Album Cover"
                            />
                        )}
                        {item.isLocked && !item.isDeleted && (
                            <IconButton icon={<Unlock size={20} />} onClick={handleUnlock} disabled={isPending} />
                        )}

                        {!item.isDeleted ? (
                            <>
                            <IconButton icon={<Heart size={20} className={isFav ? "fill-red-500 text-red-500" : ""} />} onClick={() => handleAction('fav')} disabled={isPending} />
                                <IconButton icon={<Archive size={20} className={isArchived ? "fill-blue-500 text-blue-500" : ""} />} onClick={() => handleAction('archive')} disabled={isPending} />
                                {/* <IconButton icon={<SlidersHorizontal size={20} />} onClick={() => { }} /> */}
                                {!item.isLocked && (
                                    <IconButton icon={<Lock size={20} />} onClick={handleLock} disabled={isPending} />
                                )}
                                <IconButton icon={<Trash2 size={20} />} onClick={() => handleAction('trash')} disabled={isPending} className="text-red-400 hover:text-red-500" />
                                {/* <IconButton icon={<MoreVertical size={20} />} onClick={() => { }} /> */}
                            </>
                        ) : (
                            <>
                                <IconButton icon={<RefreshCcw size={20} />} onClick={handleRestore} disabled={isPending} className="text-emerald-400" />
                                <IconButton icon={<Trash2 size={20} />} onClick={handlePermanentDelete} disabled={isPending} className="text-red-500" />
                            </>
                        )}
                    </>
                        )}
                    </div>
                </div>
                <div className="flex-1 relative flex items-center justify-center group min-h-0">
                    {index > 0 && (
                        <button onClick={goPrev} className="absolute left-6 p-3 rounded-full bg-background/5 text-foreground hover:bg-background/10 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <ChevronLeft size={32} />
                        </button>
                    )}
                    
                    {item.mimetype.startsWith("video/") ? (
                        <HLSPlayer key={item.id} mediaId={item.id} hlsPlaylistKey={item.hlsPlaylistKey} fallbackSrc={`/api/media/${item.id}?size=original`} />
                    ) : (
                        <img 
                        key={item.id} 
                        src={`/api/media/${item.id}?size=large`} 
                        className="w-full h-full object-contain select-none animate-in zoom-in-95 duration-300" 
                        alt={item.filename} 
                    />
                    )}

                    {index < items.length - 1 && (
                        <button onClick={goNext} className="absolute right-6 p-3 rounded-full bg-background/5 text-foreground hover:bg-background/10 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <ChevronRight size={32} />
                        </button>
                    )}
                </div>
            </div>
            {showInfo && (
                <div className="w-80 bg-surface border-l border-border p-6 flex flex-col h-full animate-in slide-in-from-right duration-300 z-30 overflow-y-auto">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-xl font-bold text-foreground">Info</h2>
                        <button onClick={() => setShowInfo(false)} className="text-muted hover:text-foreground">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="space-y-8">
                        <EditDetailSection
                            icon={<Type className="w-5 h-5" />}
                            label="Caption"
                            displayValue={item.caption}
                            initialEditValue={item.caption || ""}
                            onSave={async (val: string) => {
                                await updateMediaMetadata(item.id, { caption: val });
                                router.refresh();
                            }}
                        />
                        <EditDetailSection icon={<Calendar className="w-5 h-5" />} label="Date Taken" displayValue={item.dateTaken ? format(new Date(item.dateTaken), "PPP p") : "Unknown"} initialEditValue={item.dateTaken ? new Date(item.dateTaken).toISOString().slice(0, 16) : ""} 
                            type="datetime-local" onSave={async (val: string) => {
                                if (!val) return;
                                await updateMediaMetadata(item.id, { dateTaken: new Date(val) });
                                router.refresh();
                            }}  
                        />
                        {item.cameraModel && (
                            <DetailSection icon={<Camera className="w-5 h-5" />} label="Camera" value={item.cameraModel} sub={item.lensModel} />
                        )}
                        {(item.focalLength || item.fNumber || item.iso || item.exposureTime) && (
                            <DetailSection
                                icon={<Camera className="w-5 h-5" />}
                                value={[
                                    item.focalLength ? `${item.focalLength}mm` : '',
                                    item.fNumber ? `f/${item.fNumber}` : '',
                                    item.iso ? `ISO ${item.iso}` : '',
                                    item.exposureTime ? (item.exposureTime < 1 ? `1/${Math.round(1/item.exposureTime)}s` : `${item.exposureTime}s`) : ''
                                ].filter(Boolean).join(' • ')}
                            />
                        )}

                        {item.fps && (
                            <DetailSection icon={<Video className="w-5 h-5" />} value={`${item.fps.toFixed(2)} FPS`} />
                        )}
                        {item.gpsLat && (
                            <EditDetailSection 
                                icon={<MapPin className="w-5 h-5" />}
                                label="Location"
                                displayValue={item.locationCity || (item.gpsLat ? `${item.gpsLat.toFixed(4)}, ${item.gpsLng.toFixed(4)}` : "")}
                                initialEditValue={item.locationCity || (item.gpsLat ? `${item.gpsLat.toFixed(4)}, ${item.gpsLng.toFixed(4)}`: "")}
                                onSave={async (val: string) => {
                                    if (!val.trim()) return;
                                    const coords = val.split(',')
                                    if (coords.length === 2 && !isNaN(Number(coords[0])) && !isNaN(Number(coords[1]))) {
                                        await updateMediaMetadata(item.id, {
                                            gpsLat: Number(coords[0].trim()),
                                            gpsLng: Number(coords[1].trim())
                                        });
                                    } else {
                                        await updateMediaMetadata(item.id, { locationCity: val });
                                    }
                                    router.refresh();
                                }}
                            />
                        )}
                        <DetailSection icon={<FileText className="w-5 h-5" />} label="File Details" value={item.filename} sub={`${(item.size / 1024 / 1024).toFixed(2)} MB • ${item.width} x ${item.height}`} />
                        <div className="pt-6 border-t border-border">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-xs font-bold text-muted tracking-wider flex items-center gap-2">
                                    <Tag size={14} />
                                    {tagsList.length === 0 ? "Add tags" : `Tags (${tagsList.length}/5)`}
                                </h3>
                                <button onClick={() => setIsTagModalOpen(true)} className="text-muted hover:text-foreground transition-colors p-1 rounded-full hover:bg-background/10">
                                    <Edit2 size={14} />
                                </button>
                            </div>
                            {isLoadingTags ? (
                                <div className="flex items-center gap-2 text-xs text-muted font-bold">
                                    <Loader2 size={12} className="animate-spin text-orange-500" />
                                    Loading Tags..
                                </div>
                            ) : tagsList.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {tagsList.map(tag => (
                                        <span key={tag.id} onClick={() => setIsTagModalOpen(true)} className="inline-flex items-center px-2.5 py-1 rounded-full bg-surface-hover border border-border text-[10px] font-bold text-foreground cursor-pointer hover:border-orange-500/40">
                                            #{tag.name}
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
            {isShareModalOpen && (
                <ShareModal targetId={item.id} type="media" onClose={() => setIsShareModalOpen(false)} />
            )}

            <TagModal isOpen={isTagModalOpen} onClose={() => setIsTagModalOpen(false)} tagsList={tagsList} onAddTag={handleAddTag} onRemoveTag={handleRemoveTag} isLoading={isLoadingTags} newTagName={newTagName} setNewTagName={setNewTagName} />
        </div>
    );
}

function IconButton({ icon, onClick, active = false, className = "", disabled = false }: any) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`p-2.5 rounded-full transition-all active:scale-90 ${active ? "bg-background/20 text-foreground" : "text-foreground/70 hover:bg-background/10 hover:text-foreground"
                } ${className} disabled:opacity-50`}
        >
            {icon}
        </button>
    );
}

function DetailSection({ icon, label, value, sub }: any) {
    return (
        <div className="flex gap-4">
            <div className="mt-1 text-muted shrink-0">{icon}</div>
            <div>
                <p className="text-[10px] text-muted uppercase font-bold tracking-widest mb-1">{label}</p>
                <p className="text-sm text-foreground leading-snug">{value}</p>
                {sub && <p className="text-[10px] text-muted mt-1.5">{sub}</p>}
            </div>
        </div>
    );
}

function EditDetailSection({ icon, label, displayValue, initialEditValue, onSave, type = "text" }: any) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(initialEditValue || "");

    const handleSave = () => {
        onSave(editValue);
        setIsEditing(false);
    };

    return (
        <div className="flex gap-4 group">
            <div className="mt-1 text-muted shrink-0">{icon}</div>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                    <p className="text-[10px] text-muted uppercase font-bold tracking-widest mb-1">{label}</p>
                    {!isEditing && (
                        <button onClick={() => setIsEditing(true)} className="opacity-0 group-hover:opacity-100 text-muted hover:text-foreground transition-opactiy p-1">
                            <Edit2 size={12} />
                        </button>
                    )}
                </div>
                {isEditing ? (
                    <div className="flex flex-col gap-2 mt-1">
                        <input
                            type={type}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground w-full focus:outline-none focus:border-orange-500" 
                            autoFocus />
                        <div className="flex gap-3">
                            <button onClick={handleSave} className="text-orange-500 hover:text-orange-400 text-xs font-bold transition-colors">Save</button>
                            <button onClick={() => { setIsEditing(false); setEditValue(initialEditValue || ""); }} className="text-muted hover:text-foreground text-xs transition-colors">Cancel</button>
                        </div>
                    </div>
                ) : (
                    <p className={`text-sm leading-snug break-words ${displayValue ? "text-foreground" : "text-muted italic"}`}>
                        {displayValue || `Add ${label}`}
                    </p>
                )}
            </div>
        </div>
    );
}