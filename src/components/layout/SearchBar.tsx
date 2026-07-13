"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

type SearchMode = "context" | "filename" | "ocr";

export default function SearchBar() {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [mode, setMode] = useState<SearchMode>("context");
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && query.trim()) {
            router.push(`/search?q=${encodeURIComponent(query.trim())}&mode=${mode}`);
            setDropdownOpen(false);
        }
    };

    const labels: Record<SearchMode, string> = {
        context: "Context",
        filename: "Filename",
        ocr: "OCR"
    };

    return (
        <div className="relative group flex-1 max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-orange-500 transition-colors" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKeyDown} placeholder="Search image.." className="w-full bg-surface-hover border border-border rounded-full py-2.5 pl-12 pr-32 text-sm text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all" />
            <div className="absolute right-2 top-1/2 -translate-y-1/2" ref={dropdownRef}>
                <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-full text-xs font-medium text-foreground hover:bg-surface-hover transition-colors shadow-sm">
                    {labels[mode]}
                    <ChevronDown size={14} className="text-muted" />
                </button>
                {dropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-36 bg-surface border border-border rounded-lg shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                        {(Object.entries(labels) as [SearchMode, string][]).map(([key, label]) => (
                            <button key={key} onClick={() => { setMode(key as SearchMode); setDropdownOpen(false); }} className={`w-full text-left px-4 py-2 text-sm transition-colors ${mode === key ? "text-orange-500 bg-orange-500/10 font-semibold" : "text-foreground hover:bg-surface-hover"}`}>
                                {label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}