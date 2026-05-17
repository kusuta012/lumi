"use client";

import { useState } from "react";
import Lightbox from "./Lightbox";

interface MediaItem {
    id: string,
    filename: string;
    dateTaken?: string;
    createdAt: string;
}

interface Props {
    initialMedia: any[];
    startYear: number;
    endYear: number;
}

export default function TimelineGallery({ initialMedia, startYear, endYear }: Props) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    const groupedMedia = initialMedia.reduce<Record<string, MediaItem[]>>((acc, item) => {
        const dateKey = new Date(item.dateTaken || item.createdAt).toLocaleDateString('en-US', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
        });
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(item);
        return acc;
    }, {} as Record<string, any[]>);

    return(
        <div className="p-6 pb-24 relative">
            {initialMedia.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
                    <p>No photos yet. Click upload in the top right</p>
                </div>
            ) : (
                <div className="space-y-12">
                    {Object.entries(groupedMedia).map(([date, items]) => (
                        <div key={date}>
                            <h2 className="text-sm font-semibold text-neutral-300 mb-4 sticky top-0 py-2 bg-[#0a0a0a]/80 backdrop-blur-md z-10">{date}</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
                                {items.map((item) => (
                                    <div key={item.id} onClick={() => setSelectedIndex(initialMedia.indexOf(item))} className="relative group aspect-square bg-neutral-900 overflow-hidden cursor-pointer hover:ring-2 ring-orange-500 transition-all">
                                        <img src={`/api/media/${item.id}?size=small`} alt={item.filename} className="w-full h-full object-cover transition-transform duration-500 group:hover:scale-110" loading="lazy" />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-200" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="fixed right-4 top-24 bottom-12 w-6 hidden xl:flex flex-col items-center justify-between py-4 text-[11px] text-neutral-500 font-bold z-10 pointer-events-none">
                <span>{startYear}</span>
                <div className="flex-1 w-[1px] bg-neutral-800 my-4 relative">
                    <div className="absolute top-1/4 w-1.5 h-1.5 rounded-full bg-neutral-700 -left-[2.5px]"></div>
                    <div className="absolute top-1/4 w-1.5 h-1.5 rounded-full bg-neutral-700 -left-[2.5px]"></div>
                    <div className="absolute top-1/4 w-1.5 h-1.5 rounded-full bg-neutral-700 -left-[2.5px]"></div>
                </div>
                <span>{endYear}</span>
            </div>
            {selectedIndex !== null && (
                <Lightbox items={initialMedia} index={selectedIndex} setIndex={(i: number) => setSelectedIndex(i)} onClose={() => setSelectedIndex(null)} />
            )}
        </div>
    );
}