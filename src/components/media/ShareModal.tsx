"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { X, Share2, Download, Clock, Copy, Check, UploadCloud, Lock, Shield, Search, UserPlus, Users } from "lucide-react";
import { createShareLink, searchUsersAction, shareBulkMedia, updateAlbumContributors, getAlbumContributors } from "@/server/actions/share-actions";
import { useNotification } from "../providers/NotificationProvider";
import { useSession } from "next-auth/react";

interface ShareModalProps {
    targetId?: string;
    selectedIds?: string[];
    type: 'media' | 'album';
    onClose: () => void;
    onSuccess?: () => void;
    currentRole?: string;
}

interface SearchUser {
    id: string;
    username: string;
    email: string;
}

export default function ShareModal({ targetId, selectedIds, type, onClose, onSuccess, currentRole = 'viewer' }: ShareModalProps) {
    const { notify } = useNotification();
    const [isPending, startTransition] = useTransition();
    const [activeTab, setActiveTab] = useState<'link' | 'invite'>(type === 'album' ? 'invite' : 'link');
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [albumName, setAlbumName] = useState("");
    const [allowDownload, setAllowDownload] = useState(true);
    const [allowUpload, setAllowUpload] = useState(false);
    const [requireLogin, setRequireLogin] = useState(false);
    const [expiryDays, setExpiryDays] = useState<number | undefined>(undefined);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState<{ id: string; username: string; role: 'viewer' | 'contributor' | 'co_owner' }[]>([]);
    const { data: session } = useSession();
    const isAlbum = type === 'album' || (selectedIds && selectedIds.length > 1);
    const canManagePublicLinks = currentRole === 'owner' || currentRole === 'co_owner';
    
    useEffect(() => {
        if (isAlbum && targetId) {
            getAlbumContributors(targetId).then(res => {
                if (res.success){
                    const others = (res.contributors as any[]).filter(c => c.id !== session?.user?.id);
                    setSelectedUsers(others);
                }
            });
        }
    }, [targetId, isAlbum, session?.user?.id]);

    useEffect(() => {
        if (searchQuery.length < 2) {
            setSearchResults([]);
            return;
        }

        const delayBounceFn = setTimeout(async () => {
            setIsSearching(true);
            const res = await searchUsersAction(searchQuery);
            if (res.success) {
                const filtered = (res.users || []).filter((u: any) => u.id !== session?.user?.id && !selectedUsers.find(su => su.id === u.id));
                setSearchResults(filtered);
            }
            setIsSearching(false);
        }, 400);
        return () => clearTimeout(delayBounceFn);
    }, [searchQuery, selectedUsers]);
  
    const handleCreateLink = () => {
        startTransition(async () => {
            let res;
            if (selectedIds && selectedIds.length > 0) {
                res = await shareBulkMedia(selectedIds, albumName.trim() || "Shared Collection", allowDownload, allowUpload, requireLogin, expiryDays);
            } else if (targetId) {
                res = await createShareLink({
                targetId,
                targetType: type,
                allowDownload,
                allowUpload,
                requireLogin,
                expiresInDays: expiryDays
                });
            }
                
            if (res?.success) {
                setShareUrl(`${window.location.origin}/s/${res.token}`);
                if (onSuccess) onSuccess();
            } else {
                notify("error", "Failed", `${res?.error}`);
            }
        });
    };

    const handleSaveInvites = () => {
        if (!targetId || type !== 'album') return;

        startTransition(async () => {
            const mappedContributors = selectedUsers.map(u => ({ userId: u.id, role: u.role }));
            const res = await updateAlbumContributors(targetId, mappedContributors);

            if (res.success) {
                notify("success", "Saved", "Collaborators updated successfully");
                onClose();
            } else {
                notify("error", "Error", "Failed to update collaborators");
            }
        });
    };

    const copyToClipboard = () => {
        if (!shareUrl) return;
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    

    return (
        <div className="fixed inset-0 z-[120] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-background/50">
                    <h2 className="text-foreground font-bold text-lg flex items-center gap-2">
                        <Share2 size={18} className="text-orange-500" /> Share {isAlbum ? 'Album' : 'Photo'}
                    </h2>
                    <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
                        <X size={20} />
                    </button>
                </div>
                {isAlbum && !shareUrl && (
                    <div className="flex border-b border-border bg-background/30">
                        <button onClick={() => setActiveTab('invite')} className={`flex-1 py-3 text-xs font-bold tracking-wider transition-colors ${activeTab === 'invite' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-muted hover:text-foreground'}`}>
                            Invite People
                        </button>
                        {canManagePublicLinks && (
                            <button onClick={() => setActiveTab('link')} className={`flex-1 py-3 text-xs font-bold tracking-wider transition-colors ${activeTab === 'link' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-muted hover:text-foreground'}`}>
                                Public Link
                            </button>
                        )}
                    </div>
                )}
                <div className="p-6">
                    {shareUrl ? (
                        <div className="space-y-6 animate-in slide-in-from-right duration-300">
                            <div className="text-center space-y-2">
                                <div className="w-12 h-12 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Check size={24} />
                                </div>
                                <h3 className="text-foreground font-bold">Link generated</h3>
                                <p className="text-xs text-muted">anyone with this link can view the media</p>
                            </div>
                            <div className="flex items-center gap-2 p-2 bg-background border border-border rounded-xl">
                                <input readOnly value={shareUrl} className="flex-1 bg-transparent text-sm text-foreground px-2 outline-none truncate" />
                                <button onClick={copyToClipboard} className="p-2 bg-surface-hover hover:bg-surface-hover text-foreground rounded-lg transition-colors flex items-center gap-2 text-xs font-bold">
                                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                    {copied ? "Copied" : "Copy"}
                                </button>
                            </div>
                        </div>
                    ) : activeTab === 'link' ? (
                        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                            {selectedIds && selectedIds.length > 1 && (
                                    <input placeholder="Collection name" value={albumName} onChange={e => setAlbumName(e.target.value)} className="w-full bg-background border border-border p-3 rounded-xl text-foreground outline-none focus:border-orange-500 mb-2 text-sm font-medium" />
                                )}
                                <div className="flex items-center justify-between p-3 border border-border rounded-xl bg-background">
                                    <div className="flex items-center gap-3">
                                        <Download size={18} className="text-muted" />
                                    <div>
                                        <p className="text-sm font-bold text-foreground">Allow Downloads</p>
                                        <p className="text-[10px] text-muted">Viewers can save</p>
                                    </div>
                                </div>
                                <button onClick={() => setAllowDownload(!allowDownload)} className={`w-10 h-5 rounded-full relative transition-colors ${allowDownload ? 'bg-orange-500' : 'bg-surface-hover'}`}>
                                <div className={`w-3 h-3 bg-background rounded-full absolute top-1 transition-transform ${allowDownload ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>
                            {isAlbum && (
                                <div className="flex items-center justify-between p-3 border border-border rounded-xl bg-background">
                                <div className="flex items-center gap-3">
                                    <UploadCloud size={18} className="text-muted" />
                                    <div>
                                        <p className="text-sm font-bold text-foreground">Allow Uploads</p>
                                        <p className="text-[10px] text-muted">Viewers can add media</p>
                                    </div>
                                </div>
                                <button onClick={() => setAllowUpload(!allowUpload)} className={`w-10 h-5 rounded-full relative transition-colors ${allowUpload ? 'bg-orange-500' : 'bg-surface-hover'}`}>
                                    <div className={`w-3 h-3 bg-background rounded-full absolute top-1 transition-transform ${allowUpload ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>
                        )}
                        <div className="flex items-center justify-between p-3 border border-border rounded-xl bg-background">
                            <div className="flex items-center gap-3">
                                <Lock size={18} className="text-muted" />
                                <div>
                                    <p className="text-sm font-bold text-foreground">Require Login</p>
                                    <p className="text-[10px] text-muted">Only registered users</p>
                                </div>
                            </div>
                            <button onClick={() => setRequireLogin(!requireLogin)} className={`w-10 h-5 rounded-full relative transition-colors ${requireLogin ? 'bg-orange-500' : 'bg-surface-hover'}`}>
                                <div className={`w-3 h-3 bg-background rounded-full absolute top-1 transition-transform ${requireLogin ? 'left-6' : 'left-1'}`} />
                            </button>
                            </div>
                        <div className="flex items-center justify-between p-3 border border-border rounded-xl bg-background">
                            <div className="flex items-center gap-3">
                                <Clock size={18} className="text-muted" />
                                <div>
                                    <p className="text-sm font-bold text-foreground">Link expiry</p>
                                    <p className="text-[10px] text-muted">Auto-deactives link</p>
                                </div>
                            </div>
                            <select value={expiryDays || ""} onChange={(e) => setExpiryDays(e.target.value ? Number(e.target.value) : undefined)} className="bg-surface border border-border text-xs text-foreground p-1.5 rounded outline-none focus:border-orange-500">
                                <option value="">Never</option>
                                <option value="1">1 Day</option>
                                <option value="7">7 Days</option>
                                <option value="30">30 Days</option>
                            </select>
                        </div>
                    <button onClick={handleCreateLink} disabled={isPending} className="w-full py-3 bg-orange-600 text-foreground font-bold rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50 mt-4">
                        {isPending ? "Generating..." : "Create Link"}
                    </button>
                    </div>     
                    ) : (
                        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200 min-h-[280px] flex flex-col">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                <input type="text" placeholder="Add people by name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-background border border-border p-2.5 pl-9 rounded-xl text-sm text-foreground outline-focus focus:border-orange-500 transition-colors" />
                                {isSearching && <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />}
                            </div>
                            {searchResults.length > 0 && (
                                <div className="border border-border bg-background rounded-xl overflow-hidden shadow-lg">
                                    {searchResults.map((u) => (
                                        <div key={u.id} onClick={() => {
                                            setSelectedUsers([...selectedUsers, { id: u.id, username: u.username, role: 'viewer' }]);
                                            setSearchQuery("");
                                            setSearchResults([]);
                                        }}
                                        className="px-4 py-2.5 hover:bg-surface-hover cursor-pointer flex items-center justify-between group transition-colors">
                                        <div>
                                            <p className="text-sm font-bold text-foreground">{u.username}</p>
                                            <p className="text-[10px] text-muted">{u.email}</p>
                                        </div>
                                        <UserPlus size={16} className="text-muted group-hover:text-orange-500 transition-colors" />
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex-1 overflow-y-auto space-y-2 mt-4 custom-scrollbar">
                                {selectedUsers.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-muted py-8">
                                        <Users size={32} className="opacity-20 mb-2" />
                                        <p className="text-xs font-medium">No collaborators added yet</p>
                                    </div>
                                ) : (
                                    selectedUsers.map((user, idx) => (
                                        <div key={user.id} className="flex items-center justify-between p-3 border border-border bg-surface-hover rounded-xl">
                                            <p className="text-sm font-bold text-foreground truncate max-w-[120px]">{user.username}</p>
                                            <div className="flex items-center gap-2">
                                                <select value={user.role} onChange={(e) => {
                                                    const newArr = [...selectedUsers];
                                                    newArr[idx].role = e.target.value as any;
                                                    setSelectedUsers(newArr);
                                                }}
                                                className="bg-background border border-border text-xs font-medium text-foreground py-1 px-2 rounded outline-none focus:border-orange-500">
                                                    <option value="viewer">Viewer</option>
                                                    <option value="contributor">Contributor</option>
                                                    {currentRole === 'owner' && (
                                                        <option value="co_owner">Co-owner</option>
                                                    )}
                                                </select>
                                                <button onClick={() => setSelectedUsers(selectedUsers.filter(u => u.id !== user.id))} className="text-muted hover:text-red-400 transition-colors p-1">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <button onClick={handleSaveInvites} disabled={isPending || selectedUsers.length === 0} className="w-full py-3 bg-orange-600 text-foreground font-bold rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50 mt-auto flex items-center justify-center gap-2">
                                {isPending ? "Saving..." : <>Save Permissions</>}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}