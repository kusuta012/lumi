"use client";

import { useEffect, useRef, useState } from "react";

export interface ScrubberPoint {
    label: string;
    month: string;
    index: number;
    jumpYear?: number;
    jumpMonth?: number;
}

interface Props {
    points: ScrubberPoint[];
    onScrollTo: (index: number, jumpYear?: number, jumpMonth?: number) => void;
}

export default function TimelineScrub({ points, onScrollTo }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isHovered, setIsHovered] = useState(false);

    const maxScale = 1.6;
    const width = 45;
    const pushKick = -28;

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const mouseY = e.clientY - rect.top;

        const items = container.querySelectorAll(".scrubber-item");
        items.forEach((item) => {
            const itemEl = item as HTMLElement;
            const itemRect = itemEl.getBoundingClientRect();
            const itemY = (itemRect.top + itemRect.height / 2) - rect.top;

            const dist = Math.abs(mouseY - itemY);
            const scale = 1 + (maxScale - 1) * Math.exp(-(dist * dist) / (2 * width * width));
            const kick = (scale - 1) * pushKick;
            itemEl.style.transformOrigin = "right center";
            itemEl.style.transform = `scale(${scale}) translateX(${kick}px)`;
            const label = itemEl.querySelector(".month-label") as HTMLElement;

            if (dist < 15) {
                itemEl.style.color = "var(--color-orange-500)";
            } else {
                itemEl.style.color = "";
            }
        });
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        const container = containerRef.current;
        if (!container) return;

        const items = container.querySelectorAll(".scrubber-item");
        items.forEach((item) => {
            const itemEl = item as HTMLElement;
            itemEl.style.transform = "";
            const label = itemEl.querySelector(".month-label") as HTMLElement;
            if (label) {
                label.style.opacity = "";
                label.style.transform = "";
            }
        });
    };

    return (
        <div 
            ref = {containerRef}
            onMouseEnter={() => setIsHovered(true)}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className={`fixed right-0 top-1/2 -translate-y-1/2 py-6 w-16 z-[100] flex flex-col items-end pr-2.5 select-none transition-all duration-300 rounded-l-3xl ${isHovered ? "translate-x-0 bg-background/60 backdrop-blur-xl border border-r-0 border-border/30 opacity-100" : "translate-x-[30%] opacity-60 bg-background/10 backdrop-blur-sm"}`}>
                <div className="flex flex-col items-end gap-1.5 w-full">
                    {points.map((cp, i) => {
                        const isYear = cp.label !== "";
                        const displayText = isYear ? cp.label : cp.month;
                        return (
                            <div key={i} onClick={() => onScrollTo(cp.index, cp.jumpYear, cp.jumpMonth)} className={`scrubber-item relative flex items-center justify-end w-full cursor-pointer group transition-shadow duration-200 ${isYear ? 'mt-2 mb-1' : ''}`}>
                                    <span className={`tracking tighter ${
                                        isYear
                                            ? 'font-black text-foreground text-[11px]'
                                            : 'font-bold text-muted text-[9px] hover:text-foreground'
                                    }`}>
                                        {displayText}
                                    </span>
                            </div>
                        );
                    })}
                </div>
            </div>
    );
}