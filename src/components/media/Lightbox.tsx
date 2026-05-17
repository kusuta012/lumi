"use client";

import { X, Calendar, Camera, MapPin, FileText, Heart, Trash2, Info, ChevronLeft, ChevronRight, Download, Copy, Maximize2, Share2, SlidersHorizontal, MoreVertical } from "lucide-react";
import { format } from "date-fns";
import { useTransition, useState, useEffect } from "react";
import { toggleFavoriteAction, toggleArchiveAction, toggleTrashAction } from "@/server/actions/media-mutations";
import { useRouter } from "next/navigation";

interface LightboxProps {
    items: any[];
    index: number;
    setIndex: (i: number) => void;
    onClose: () => void;
}

export default function Lightbox({ items, index, setIndex, onClose }: LightboxProps) {
    const item = items[index];
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [showInfo, setShowInfo] = useState(false);
    const [isFav, setIsFav] = useState(item.isFavorited);
    const [isArchived, setIsArchived] = useState(item.isArchived);

    useEffect(() => {
        setIsFav(item.isFavorited);
        setIsArchived(item.isArchived);
    }, [item]);

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
            const res = await fetch(`/api/media/${item.id}?size=medium`);
            const blob = await res.blob();
            await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
            alert("Copied to clipboard");
        } catch (e) {
            console.error(e)
            alert("failed");
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black flex overflow-hidden animate-in fade-in duration-200">
            <div className="flex-1 relative flex flex-col h-full overflow-hidden">
                <div className="h-16 flex items-center justify-between px-4 bg-gradient-to-b from-black/70 to-transparent absolute top-0 w-full z-20">
                    <button onClick={onClose} className="p-2 text-white/80 hover:text-white transition-colors">
                        <X size={24} />
                    </button>

                    <div className="flex items-center gap-1 sm:gap-2">
                        {/* <IconButton icon={<Share2 size={20} />} onClick={() => { }} /> */}
                        <IconButton icon={<Maximize2 size={20} />} onClick={() => document.documentElement.requestFullscreen()} />
                        <IconButton icon={<Copy size={20} />} onClick={handleCopy} />
                        <IconButton icon={<Download size={20} />} onClick={handleDownload} />
                        <IconButton icon={<Info size={20} />} onClick={() => setShowInfo(!showInfo)} active={showInfo} />
                        <IconButton icon={<Heart size={20} className={isFav ? "fill-red-500 text-red-500" : ""} />} onClick={() => handleAction('fav')} disabled={isPending} />
                        {/* <IconButton icon={<SlidersHorizontal size={20} />} onClick={() => { }} /> */}
                        <IconButton icon={<Trash2 size={20} />} onClick={() => handleAction('trash')} disabled={isPending} className="text-red-400 hover:text-red-500" />
                        {/* <IconButton icon={<MoreVertical size={20} />} onClick={() => { }} /> */}
                    </div>
                </div>
                <div className="flex-1 relative flex items-center justify-center group">
                    {index > 0 && (
                        <button onClick={goPrev} className="absolute left-6 p-3 rounded-full bg-white/5 text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <ChevronLeft size={32} />
                        </button>
                    )}
                    
                    {item.mimetype.startsWith("video/") ? (
                        <video key={item.id} src={`/api/media/${item.id}?size=original`} controls autoPlay className="max-w-full max-h-full outline-none shadow-2xl" />
                    ) : (
                        <img 
                        key={item.id} 
                        src={`/api/media/${item.id}?size=large`} 
                        className="max-w-full max-h-full object-contain select-none animate-in zoom-in-95 duration-300" 
                        alt={item.filename} 
                    />
                    )}

                    {index < items.length - 1 && (
                        <button onClick={goNext} className="absolute right-6 p-3 rounded-full bg-white/5 text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <ChevronRight size={32} />
                        </button>
                    )}
                </div>
            </div>
            {showInfo && (
                <div className="w-80 bg-[#0d0d0d] border-l border-neutral-800 p-6 flex flex-col h-full animate-in slide-in-from-right duration-300 z-30 overflow-y-auto">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-xl font-bold text-white">Info</h2>
                        <button onClick={() => setShowInfo(false)} className="text-neutral-500 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="space-y-8">
                        <DetailSection icon={<Calendar className="w-5 h-5" />} label="Date Taken" value={item.dateTaken ? format(new Date(item.dateTaken), "PPP p") : "Unknown"} />
                        {item.cameraModel && (
                            <DetailSection icon={<Camera className="w-5 h-5" />} label="Camera" value={item.cameraModel} />
                        )}
                        {item.gpsLat && (
                            <DetailSection icon={<MapPin className="w-5 h-5" />} label="Location" value={`${item.gpsLat.toFixed(4)}, ${item.gpsLng.toFixed(4)}`} />
                        )}
                        <DetailSection icon={<FileText className="w-5 h-5" />} label="File Details" value={item.filename} sub={`${(item.size / 1024 / 1024).toFixed(2)} MB • ${item.width} x ${item.height}`} />
                    </div>
                </div>
            )}
        </div>
    );
}

function IconButton({ icon, onClick, active = false, className = "", disabled = false }: any) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`p-2.5 rounded-full transition-all active:scale-90 ${active ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                } ${className} disabled:opacity-50`}
        >
            {icon}
        </button>
    );
}

function DetailSection({ icon, label, value, sub }: any) {
    return (
        <div className="flex gap-4">
            <div className="mt-1 text-neutral-500 shrink-0">{icon}</div>
            <div>
                <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-1">{label}</p>
                <p className="text-sm text-neutral-200 leading-snug">{value}</p>
                {sub && <p className="text-[10px] text-neutral-500 mt-1.5">{sub}</p>}
            </div>
        </div>
    );
}