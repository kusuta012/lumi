"use client";

import { X, Tag, Loader2 } from "lucide-react";

interface TagModalProps {
    isOpen: boolean;
    onClose: () => void;
    tagsList: Array<{ id: string; name: string }>;
    onAddTag: (e: React.SyntheticEvent) => void;
    onRemoveTag: (tagId: string, tagName: string) => void;
    isLoading: boolean;
    newTagName: string;
    setNewTagName: (name: string) => void;
}

export default function TagModal({isOpen, onClose, tagsList, onAddTag, onRemoveTag, isLoading, newTagName, setNewTagName}: TagModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-background/80 backdrop-blur-md">
            <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200 text-left relative flex flex-col max-h-[80vh]">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold text-foreground">Edit Tags</h2>
                    <button onClick={onClose} className="text-muted hover:text-foreground transition-colors p-1 rounded-full hover:bg-background/10">
                        <X size={18} />
                    </button>
                </div>
                {tagsList.length < 5 ? (
                    <form onSubmit={onAddTag} className="relative mb-6 flex items-center border-b border-border focus-within:border-orange-500 transition-colors pb-1">
                        <input type="text" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Enter Tag" maxLength={20} className="w-full bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none py-1.5 autoFocus" />
                        <button type="submit" disabled={!newTagName.trim()} className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors active:scale-95 shrink-0">
                            Add
                        </button>
                    </form>
                ) : (
                    <p className="text-xs text-muted font-semibold mb-6 text-center py-2 bg-surface-hover rounded-lg">
                        Maximum limit of 5 tags reacehd
                    </p>
                )}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[120px] max-h-[300px]">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8 text-xs text-muted font-bold gap-2">
                            <Loader2 size={14} className="animate-spin text-orange-500" />
                            Loading...
                        </div>
                    ) : tagsList.length > 0 ? (
                        tagsList.map((tag: any) => (
                            <div key={tag.id} className="flex justify-between items-center px-4 py-2 bg-surface-hover rounded-lg border border-border">
                                <span className="text-xs font-bold text-foreground font-sans">#{tag.name}</span>
                                <button onClick={() => onRemoveTag(tag.id, tag.name)} className="text-muted hover:text-red-400 p-1 rounded-full hover:bg-background/20 transition-colors">
                                    <X size={14} />
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-muted text-center">
                            <Tag size={24} className="opacity-15 mb-2" />
                            <p className="text-xs font-semibold">No tags added yet</p>
                        </div>
                    )}
                </div>
                <div className="h-px bg-border my-4" />
                <div className="flex justify-between items-center text-[10px] text-muted font-semibold">
                    <span className="font-bold tracking-wider">Tags ({tagsList.length}/5)</span>
                </div>
            </div>
        </div>
    )
}