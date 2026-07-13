"use client"

import Link from "next/link";
import { HighlightItem } from "@/server/queries/explore";
import Lightbox from "../media/Lightbox";
import { useState } from "react";

interface Props {
    highlights: HighlightItem[];
}

export default function RcntHighlights({ highlights }: Props) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    return (
        <>
        <div className="flex gap-6 overflow-x-auto custom-scrollbar pb-4 select-none">
            {highlights.map((item, index) => (
                <div
                key={item.id}
                onClick={() => setSelectedIndex(index)}
                className="relative flex-none w-64 aspect-[3/4] rounded-2xl overflow-hidden border border-border shadow-lg hover:border-orange-500/40 hover:shadow-xl transition-all duration-300 group">
                    <img
                        src={`/api/media/${item.id}?size=medium`}
                        alt={item.filename}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                        <div className="absolute bottom-4 left-4 right-4 text-left">
                            <p className="text-xs font-bold text-foreground mt-1 truncate">
                                {item.filename}
                            </p>
                        </div>
                </div>
            ))}
        </div>

        {selectedIndex !== null && (
            <Lightbox
                items = {highlights as any}
                index={selectedIndex}
                setIndex={(i: number) => setSelectedIndex(i)}
                onClose={() => setSelectedIndex(null)}
                isOwner={true}
                allowDownload={true}
            />
        )}
    </>
    );
}