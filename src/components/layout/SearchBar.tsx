"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchBar() {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && query.trim()) {
            router.push(`/search?q=${encodeURIComponent(query.trim())}`);
        }
    };

    return (
        <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-orange-500 transition-colors" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKeyDown} placeholder="Search image.." className="w-full bg-surface-hover border border-border rounded-full py-2 pl-12 pr-4 text-sm text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-orange-500 transition-all"></input>
        </div>
    );
}