"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import PersonCard from "./PersonCard";

export default function HiddenPeople({ hiddenPeople, allPeople }: { hiddenPeople: any[]; allPeople: any[] }) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (hiddenPeople.length === 0) return null;

    return (
        <div className="mt-12 border-t border-border pt-8">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors mb-6"
            >
                {isExpanded ? <EyeOff size={16} /> : <Eye size={16} />}
                {isExpanded ? "Hide" : "Show"} {hiddenPeople.length} hidden {hiddenPeople.length === 1 ? "person" : "people"}
            </button>
            {isExpanded && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8 opacity-60">
                    {hiddenPeople.map((person) => (
                        <PersonCard key={person.id} person={person} allPeople={[...allPeople, ...hiddenPeople]} isHidden />
                    ))}
                </div>
            )}
        </div>
    );
}