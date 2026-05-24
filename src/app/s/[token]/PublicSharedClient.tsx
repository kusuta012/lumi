"use client";

import { useState } from "react";
import { Download, X, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import PublicUploadButton from "@/components/sharing/PublicUploadButton";

interface Props {
    token: string;
    title: string;
    items: any[];
    ownerName: string;
    allowDownload: boolean;
    allowUpload: boolean;
}

export default function PublicSharedClient({ token, title, items, ownerName, allowDownload, allowUpload }: Props) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const handleDownload = async (item: any) => {
        if (!allowDownload) return;
        const res = await fetch(`/api/shared/${token}/media/${item.id}?size=original`);
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement(`a`);
        a.href = url;
        a.download = item.filename;
        a.click();
    };

    const groupedMedia = items.reduce((acc , item) => {
        const d = new Date(item.dateTaken || item.createdAt);
        const dateKey = d.toLocaleDateString('en-US', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
        });
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(item);
        return acc;
    }, {} as Record<string, any[]>);
    
    const sortedGroups = Object.entries(groupedMedia).sort((a: any, b: any) => {
        const timeA = new Date(a[1][0].dateTaken || a[1][0].createdAt).getTime();
        const timeB = new Date(b[1][0].dateTaken || b[1][0].createdAt).getTime();
        return timeB - timeA;
    });

    const goNext = () => selectedIndex !== null && selectedIndex < items.length - 1 && setSelectedIndex(selectedIndex + 1);
    const goPrev = () => selectedIndex !== null && selectedIndex > 0 && setSelectedIndex(selectedIndex - 1);

    return (
        <div className="bg-background min-h-screen text-foreground">
            <div className="p-8 max-w-6xl mx-auto pb-32">
                <header className="mb-12 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-border pb-8">
                    <div>
                    <h1 className="text-3xl font-black text-foreground tracking-tight">{title}</h1>
                    <p className="text-muted text-xs mt-1 font-bold tracking-widest">Shared by <span className="text-orange-300" >{ownerName}</span> | <span className="text-muted">{items.length} items</span></p>
                    </div>
                    {allowUpload && <PublicUploadButton token={token} /> }
                </header>
                {items.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center border border-border border-dashed text-muted text-sm">
                        No media in this shared album yet
                    </div>
                ) : (
                    <div className="space-y-12">
                        {sortedGroups.map(([date, groupItems]: any) => (
                            <div key={date}>
                                <h2 className="text-xs font-bold text-muted tracking-widest mb-b border-b border-border pb-2">
                                    {date}
                                </h2>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                                    {groupItems.map((item: any) => (
                                        <div key={item.id} onClick={() => setSelectedIndex(items.indexOf(item))} className="relative aspect-square bg-background border border-border overflow-hidden cursor-pointer hover:border-orange-500/50 transition-all group">
                                            <img src={`/api/shared/${token}/media/${item.id}?size=small`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" />
                                            <div className="absolute inset-0 bg-background/0 group-hover:bg-background/10 transition-colors" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {selectedIndex !== null && items.length > 0 && (
                <div className="fixed inset-0 z-50 bg-background flex overflow-hidden animate-in fade-in duration-200">
                    <div className="flex-1 relative flex flex-col h-full overflow-hidden">
                        <div className="h-16 flex items-center justify-between px-4 bg-gradient-to-b from-black/70 to-transparent absolute w-full z-20">
                            <button onClick={() => setSelectedIndex(null)} className="p-2 text-foreground/80 hover:text-foreground transition-colors">
                                <X size={24} />
                            </button>
                            <div className="flex gap-2">
                                <button onClick={() => document.documentElement.requestFullscreen()} className="p-2.5 text-foreground/70 hover:text-foreground transition-all rounded-full hover:bg-background/10">
                                    <Maximize2 size={20} />
                                </button>
                                {allowDownload && (
                                    <button onClick={() => handleDownload(items[selectedIndex])} className="p-2.5 text-foreground/70 hover:text-foreground transition-all rounded-full hover:bg-background/10">
                                        <Download size={20} />
                                    </button>
                                )}
                            </div>
                        </div>
                    <div className="flex-1 relative flex items-center justify-center group">
                        {selectedIndex > 0 && (
                            <button onClick={goPrev} className="absolute left-6 p-3 rounded-full bg-background/5 text-foreground hover:bg-background/10 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <ChevronLeft size={32} />
                            </button>
                        )}
                        {items[selectedIndex].mimetype.startsWith("video/") ? (
                            <video src={`/api/shared/${token}/media/${items[selectedIndex].id}?size=original`} controls autoPlay className="max-w-full max-h-full outline-none" />
                        ) : (
                            <img src={`/api/shared/${token}/media/${items[selectedIndex].id}?size=large`} className="max-w-full max-h-full object-contain" alt="" />
                        )}
                        {selectedIndex < items.length - 1 && (
                            <button onClick={goNext} className="absolute right-6 p-3 rounded-full bg-background/5 text-foreground hover:bg-background/10 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <ChevronRight size={32} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )}
        </div>
    );
}