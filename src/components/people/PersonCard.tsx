"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { MoreVertical, Edit2, Merge, EyeOff, Eye, User } from "lucide-react";
import { renamePerson, toggleHidePerson, mergePeople } from "@/server/actions/people-actions";
import { useRouter } from "next/navigation";
import { useNotification } from "../providers/NotificationProvider";

export default function PersonCard({ person, allPeople, isHidden = false }: { person: any; allPeople: any[]; isHidden?: boolean }) {
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const menuRef = useRef<HTMLDivElement>(null);
    const { notify } = useNotification();

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleHide = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuOpen(false);

        const msg = isHidden ? `Unhide "${person.name}"?` : `Hide "${person.name}" from your library?`

        if (confirm(msg)) {
            startTransition(async () => {
                const res = await toggleHidePerson(person.id, !isHidden);
                if (res && res.success) {
                    notify("success", isHidden ? "Unhidden" : "Hidden" , `Person has been ${isHidden ?"unhidden" : "hidden"}`);
                    router.refresh();
                } else {
                    notify("error", "Error", "Failed to update person");
                }
            });
        }
    };

    return (
        <>
            <div className="relative group flex flex-col items-center text-center">
                <Link href={`/people/${person.id}`} className="block w-full">
                    <div className="aspect-square w-full max-w-[180px] mx-auto bg-surface rounded-full overflow-hidden mb-3 relative border border-border shadow-lg group-hover:border-orange-500/50 group-hover:shadow-xl transition-all">
                        {person.coverFaceId ? (
                            <img src={`/api/media/faces/${person.coverFaceId}`} alt={person.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted bg-surface-hover">
                                <User size={48} className="opacity-40" />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-background/30 to-transparent opacity-0 group-hover:opacity-40 transition-opacity" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground group-hover:text-orange-500 transition-colors truncate px-2">
                        {person.name}
                    </h3>
                    <p className="text-xs text-muted mt-1">
                        {person.faceCount} {person.faceCount === 1 ? "photo" : "photos"}
                    </p>
                </Link>
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(!menuOpen); }} className={`absolute top-2 right-4 p-1.5 rounded-full backdrop-blur-md border border-white/10 text-foreground/80 opacity-0 group-hover:opacity-100 hover:bg-surface-hover hover:text-foreground transition-all z-10`}>
                    <MoreVertical size={16} />
                </button>
                {menuOpen && (
                    <div ref={menuRef} className="absolute top-12 right-4 w-48 bg-surface border-border rounded-lg shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-left">
                        <button onClick={(e) => { e.stopPropagation(); setIsRenameModalOpen(true); setMenuOpen(false); }} className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-foreground hover:bg-surface-hover hover:text-foreground transition-colors">
                            <Edit2 size={16} /> Rename Person
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setIsMergeModalOpen(true); setMenuOpen(false); }} className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-foreground hover:bg-surface-hover hover:text-foreground transition-colors">
                            <Merge size={16} /> Merge Profiles
                        </button>
                        <div className="h-px bg-surface-hover my-1 w-full" />
                        <button onClick={handleHide} disabled={isPending} className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-red-400 hover:bg-red-950/50 hover:text-red-300 transition-colors">
                            {isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                            {isHidden ? "Unhide Person" : "Hide Person"}
                        </button>
                    </div>
                )}
            </div>

            {isRenameModalOpen && (
                <RenamePersonModal person={person} onClose={() => setIsRenameModalOpen(false)} />
            )}
            {isMergeModalOpen && (
                <MergePersonModal person={person} allPeople={allPeople} onClose={() => setIsMergeModalOpen(false)} />
            )}
        </>
    );
}

function RenamePersonModal({ person, onClose }: { person: any, onClose: () => void }) {
    const router = useRouter();
    const { notify } = useNotification();
    const [name, setName] = useState(person.name === "Unknown Person" ? "" : person.name);
    const [isPending, startTransition] = useTransition();

    const handleSubmit = (e: React.SyntheticEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        startTransition(async () => {
            const res = await renamePerson(person.id, name.trim());
            if (res?.success) {
                notify("success", "Success", "Person renamed");
                router.refresh();
                onClose();
            } else {
                notify("error", "Error", "Failed to rename person");
            }
        });
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/80 backdrop-blur-md">
            <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200 text-left">
                <h2 className="text-xl font-bold tracking-tight text-foreground mb-4">Rename Person</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-muted tracking-wider block mb-2">Name</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Type a name...." className="w-full bg-surface-hover border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all" autoFocus />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-surface-hover hover:bg-surface border border-border rounded-lg text-sm font-medium text-foreground transition-colors active:scale-95">
                            Cancel
                        </button>
                        <button type="submit" disabled={isPending || !name.trim()} className="px-4 py-2 bg-orange-500 hover:bg-orange-500 hover:bg-orange-400 text-white rounded-lg text-sm font-medium transition-colors active:scale-95 disabled:opacity-50">
                            {isPending ? "Saving..." : "Save"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function MergePersonModal({ person, allPeople, onClose }: { person: any; allPeople: any[]; onClose: () => void }) {
    const router = useRouter();
    const { notify } = useNotification();
    const [targetId, setTargetId] = useState("");
    const [isPending, startTransition] = useTransition();
    const candidates = allPeople.filter(p => p.id !== person.id);
    const handleSubmit = (e: React.SyntheticEvent) => {
        e.preventDefault();
        if (!targetId) return;

        const targetPerson = candidates.find(p => p.id === targetId);
        const confirmMsg = `Merge "${person.name}" into "${targetPerson?.name}"? All photos of both profiles will be combined under "${targetPerson.name}". This action is irreversible`;

        if (confirm(confirmMsg)) {
            startTransition(async () => {
                const res = await mergePeople(targetId, person.id);
                if (res?.success) {
                    notify("success", "Success", "Profiles merged successfully");
                    router.refresh();
                    onClose();
                } else {
                    notify("error", "Error", "Failed to merge profiles");
                }
            });
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/80 backdrop-blur-md">
            <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200 text-left">
                <h2 className="text-xl font-bold tracking-tight text-foreground mb-4">Merge Profiles</h2>
                <p className="text-sm text-muted mb-4">
                    Combine all photos of <strong className="text-foreground">{person.name}</strong> into another recongnized profile
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-muted tracking-wider block mb-2">Merge into..</label>
                        <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all">
                            <option value="">Select a person</option>
                            {candidates.map(candidate => (
                                <option key={candidate.id} value={candidate.id}>
                                    {candidate.name} ({candidate.faceCount} photos)
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-surface-hover hover:bg-surface border border-border rounded-lg text-sm font-medium text-foreground transition-colors active:scale-95">
                            Cancel
                        </button>
                        <button type="submit" disabled={isPending || !targetId} className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg text-sm font-medium transition-colors active:scale-95 disabled:opacity-50">
                            {isPending ? "Merging..." : "Merge"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}