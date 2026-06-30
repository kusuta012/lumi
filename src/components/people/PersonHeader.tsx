"use client";

import { useState, useTransition } from "react";
import { User, Edit2, Check, X, ArrowLeft } from "lucide-react";
import { renamePerson } from "@/server/actions/people-actions";
import { useRouter } from "next/navigation";
import { useNotification } from "../providers/NotificationProvider";
import Link from "next/link";

interface Props {
    person: {
        id: string;
        name: string;
        coverFaceId: string | null;
    };
    photoCount: number;
}

export default function PersonHeader({ person, photoCount }: Props) {
    const router = useRouter();
    const { notify } = useNotification();
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(person.name);
    const [isPending, startTransition] = useTransition();

    const handleSave = () => {
        if (!name.trim() || name.trim() === person.name) {
            setName(person.name);
            setIsEditing(false);
            return;
        }
        startTransition(async () => {
            const res = await renamePerson(person.id, name.trim());
            if (res?.success) {
                notify("success", "Renamed", `Person renamed to "${name.trim()}"`);
                router.refresh();
            } else {
                notify("error", "Error", "Failed to rename");
                setName(person.name);
            }
            setIsEditing(false);
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleSave();
        if (e.key === "Escape") { setName(person.name); setIsEditing(false); }
    };

    return (
        <header className="p-8 pb-0 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-20">
            <div className="mb-6 flex items-center gap-4">
                <Link href="/people" className="text-muted hover:text-foreground transition-colors">
                    <ArrowLeft size={20}  />
                </Link>
                {person.coverFaceId ? (
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-orange-500 shadow-lg flex-shrink-0">
                        <img
                            src={`/api/media/faces/${person.coverFaceId}`}
                            alt={person.name}
                            className="w-full h-full object-cover"
                        />
                    </div>
                ) : (
                    <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center flex-shrink-0 border border-border">
                        <User className="text-muted w-6 h-6" />
                    </div>
                )}
                <div>
                    {isEditing ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="text-2xl font-bold bg-surface-hover border border-border rounded-lg px-3 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                autoFocus
                            />
                            <button onClick={handleSave} disabled={isPending} className="p-1.5 rounded-full bg-orange-500 text-white hover:bg-orange-400 transition-colors">
                                <Check size={16} />
                            </button>
                            <button onClick={() => { setName(person.name); setIsEditing(false); }} className="p-1.5 rounded-full bg-surface-hover text-muted hover:text-foreground transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                    ) : (
                        <h1
                            className="text-3xl font-bold text-foreground flex items-center gap-2 group cursor-pointer"
                            onClick={() => setIsEditing(true)}
                            title="Click to rename"
                        >
                            {person.name}
                            <Edit2 size={16} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                        </h1>
                    )}
                    <p className="text-muted text-sm mt-1">
                        Showing {photoCount} {photoCount === 1 ? "photo" : "photos"} containing this face
                    </p>
                </div>
            </div>
        </header>
    );
}