"use client";

import { useState, useTransition } from "react";
import { X, Share2, Download, Clock, Copy, Check, UploadCloud, Lock } from "lucide-react";
import { createShareLink, shareBulkMedia } from "@/server/actions/share-actions";
import { useNotification } from "../providers/NotificationProvider";

interface ShareModalProps {
    targetId?: string;
    selectedIds?: string[];
    type: 'media' | 'album';
    onClose: () => void;
    onSuccess?: () => void;
}

export default function ShareModal({ targetId, selectedIds, type, onClose, onSuccess }: ShareModalProps) {
    const { notify } = useNotification();
    const [isPending, startTransition] = useTransition();
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [albumName, setAlbumName] = useState("");
    const [allowDownload, setAllowDownload] = useState(true);
    const [allowUpload, setAllowUpload] = useState(false);
    const [requireLogin, setRequireLogin] = useState(false);
    const [expiryDays, setExpiryDays] = useState<number | undefined>(undefined);
  
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
                notify("error", "Failed", `${res?.error}"`);
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
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-[#111] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-neutral-800 flex justify-between items-center relative">
                    <h2 className="text-white font-bold text-lg flex items-center gap-2">
                        <Share2 size={18} className="text-orange-500" /> Share {type === 'album' || (selectedIds && selectedIds.length > 0) ? 'Album' : 'Photo'}
                    </h2>
                    <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6">
                    {!shareUrl ? (
                        <>
                            <div className="space-y-4">
                                {selectedIds && selectedIds.length > 1 && (
                                    <input placeholder="Collection name" value={albumName} onChange={e => setAlbumName(e.target.value)} className="w-full bg-[#0a0a0a] border border-neutral-800 p-3 rounded-xl text-white outline-none focus:border-orange-500 mb-2 text-sm font-medium" />
                                )}
                                <div className="flex items-center justify-between p-3 border border-neutral-800 rounded-xl bg-[#0a0a0a]">
                                    <div className="flex items-center gap-3">
                                        <Download size={18} className="text-neutral-400" />
                                    <div>
                                        <p className="text-sm font-bold text-white">Allow Downloads</p>
                                        <p className="text-[10px] text-neutral-500">Viewers can save</p>
                                    </div>
                                </div>
                                <button onClick={() => setAllowDownload(!allowDownload)} className={`w-10 h-5 rounded-full relative transition-colors ${allowDownload ? 'bg-orange-500' : 'bg-neutral-700'}`}>
                                <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-transform ${allowDownload ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>
                            {(type === 'album' || (selectedIds && selectedIds.length > 1)) && (
                                <div className="flex items-center justify-between p-3 border border-neutral-800 rounded-xl bg-[#0a0a0a]">
                                    <div className="flex items-center gap-3">
                                        <UploadCloud size={18} className="text-neutral-400" />
                                        <div>
                                            <p className="text-sm font-bold text-white">Allow Uploads</p>
                                            <p className="text-[10px] text-neutral-500">Viewers can add media</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setAllowUpload(!allowUpload)} className={`w-10 h-5 rounded-full relative transition-colors ${allowUpload ? 'bg-orange-500' : 'bg-neutral-700'}`}>
                                        <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-transform ${allowUpload ? 'left-6' : 'left-1'}`} />
                                    </button>
                                </div>
                            )}
                            <div className="flex items-center justify-between p-3 border border-neutral-800 rounded-xl bg-[#0a0a0a]">
                                <div className="flex items-center gap-3">
                                    <Lock size={18} className="text-neutral-400" />
                                    <div>
                                        <p className="text-sm font-bold text-white">Require Login</p>
                                        <p className="text-[10px] text-neutral-500">Only registered users</p>
                                    </div>
                                </div>
                                <button onClick={() => setRequireLogin(!requireLogin)} className={`w-10 h-5 rounded-full relative transition-colors ${requireLogin ? 'bg-orange-500' : 'bg-neutral-700'}`}>
                                    <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-transform ${requireLogin ? 'left-6' : 'left-1'}`} />
                                </button>
                                </div>
                            <div className="flex items-center justify-between p-3 border border-neutral-800 rounded-xl bg-[#0a0a0a]">
                                <div className="flex items-center gap-3">
                                    <Clock size={18} className="text-neutral-400" />
                                    <div>
                                        <p className="text-sm font-bold text-white">Link expiry</p>
                                        <p className="text-[10px] text-neutral-500">Auto-deactives link</p>
                                    </div>
                                </div>
                                <select value={expiryDays || ""} onChange={(e) => setExpiryDays(e.target.value ? Number(e.target.value) : undefined)} className="bg-[#111] border border-neutral-700 text-xs text-white p-1.5 rounded outline-none focus:border-orange-500">
                                    <option value="">Never</option>
                                    <option value="1">1 Day</option>
                                    <option value="7">7 Days</option>
                                    <option value="30">30 Days</option>
                                </select>
                            </div>
                        </div>
                        <button onClick={handleCreateLink} disabled={isPending} className="w-full py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50 mt-4">
                            {isPending ? "Generating..." : "Create Link"}
                        </button>
                        </>
                    ) : (
                        <div className="space-y-6 animate-in slide-in-from-right duration-300">
                            <div className="text-center space-y-2">
                                <div className="w-12 h-12 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Check size={24} />
                                </div>
                                <h3 className="text-white font-bold">Link generated</h3>
                                <p className="text-xs text-neutral-400">anyone with this link can view the media</p>
                            </div>
                            <div className="flex items-center gap-2 p-2 bg-[#0a0a0a] border border-neutral-800 rounded-xl">
                                <input readOnly value={shareUrl} className="flex-1 bg-transparent text-sm text-neutral-300 px-2 outline-none truncate" />
                                <button onClick={copyToClipboard} className="p-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors flex items-center gap-2 text-xs font-bold">
                                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                    {copied ? "Copied" : "Copy"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}