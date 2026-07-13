"use client";

import { useState, useTransition, useEffect } from "react";
import { X, Search, UserMinus, Loader2, Image } from "lucide-react";
import { searchPeople, reassignFace, removeFaceFromPerson, setCoverFace } from "@/server/actions/people-actions";

export default function FaceReassignModal({ face, onClose, onSuccess}: { face: any, onClose: () => void, onSuccess: () => void }) {
    const [isPending, startTransition] = useTransition();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);

    useEffect(() => {
        if (query.length < 2) {
            setResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            const res = await searchPeople(query);
            if (res.success) setResults(res.people);
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);

    const handleReassign = (personId: string) => {
        startTransition(async () => {
            await reassignFace(face.id, personId);
            onSuccess();
        });
    };

    const handleRemove = () => {
        startTransition(async () => {
            await removeFaceFromPerson(face.id);
            onSuccess();
        });
    };

    return (
        <div className="fixed inset-0 z-[99999999] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-surface border border-border w-full max-w-sm overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-border flex justify-between items-center">
                    <h2 className="font-bold text-foreground">Edit Person</h2>
                    <button onClick={onClose} className="text-muted hover:text-foreground">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                        <input type="text"placeholder="Search for a person..." value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-background border border-border pl-9 pr-3 py-2 text-sm text-foreground focus:border-orange-500 outline-none" />
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                        {results.map(person => (
                            <button key={person.id} onClick={() => handleReassign(person.id)} disabled={isPending} className="w-full flex items-center gap-3 p-2 hover:bg-surface-hover text-left disabled:opacity-50">
                                <div className="w-8 h-8 rounded-full bg-background overflow-hidden border border-border flex items-center justify-center text-xs font-bold">
                                    {person.name.charAt(0)}
                                </div>
                                <span className="text-sm font-medium text-foreground">{person.name}</span>
                            </button>
                        ))}
                        {query.length >= 2 && results.length === 0 && (
                            <p className="text-xs text-muted text-center py-4">No people found</p>
                        )}
                    </div>
                </div>
                <div className="p-4 bg-background border-t border-border">
                    <div className="px-4 pb-2">
                        <button onClick={() => {
                            startTransition(async () => {
                                const res = await setCoverFace(face.personId, face.id);
                                if (res?.success) onSuccess();
                            });
                        }}
                        disabled={isPending}
                        className="w-full flex justify-center items-center gap-2 py-2 text-sm font-bold text-orange-500 hover:bg-orange/500/10 transition-colors disabled:opacity-50">
                            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Image size={16} />}
                            Set as cover photo
                        </button>
                    </div>
                    <button onClick={handleRemove} disabled={isPending} className="w-full flex justify-center items-center gap-2 py-2 text-sm font-bold text-red-500 hover:bg-red/500/10 transition-colors disabled:opacity-50">
                        {isPending ? <Loader2 size={16} className="animate-spin" /> : <UserMinus size={16} />}
                        Remove from this photo
                    </button>
                </div>
            </div>
        </div>
    );
}