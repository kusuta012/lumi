"use client";

import { Search, Bell, CheckCircle2, AlertCircle, Info, Trash2 } from "lucide-react";
import UploadButton from "../media/UploadButton";
import SearchBar from "./SearchBar";
import { useNotification } from "@/components/providers/NotificationProvider";
import { useState, useRef, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";

export default function Topbar({ user }: { user: any }) {
    const { notifications, markAllAsRead, clearAll } = useNotification();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const unreadCount = notifications.filter(n => !n.read).length;

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleOpen = () => {
        setIsOpen(!isOpen);
        if (!isOpen && unreadCount > 0) markAllAsRead();
    };

    return (
        <header className="h-16 shrink-0 flex items-center justify-between px-6 bg-[#0a0a0a] border-b border-neutral-900 z-50">
            <div className="flex-1 max-w-2xl">
                <SearchBar />
            </div>
            <div className="flex items-center gap-4 ml-6">
                <UploadButton />
                <div className="relative" ref={menuRef}>
                <button onClick={handleOpen} className={`p-2 rounded-full transition-colors relative ${isOpen ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}>
                    <Bell className="w-5 h-5"></Bell>
                    {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse border border-[#0a0a0a]" />
                    )}
                </button>
                {isOpen && (
                    <div className="absolute top-12 right-0 w-80 md:w-96 bg-[#1a1a1a] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between bg-[#111]">
                            <h3 className="text-white font-bold text-sm">Notifications</h3>
                            {notifications.length > 0 && (
                                <button onClick={clearAll} className="text-[10px] font-bold text-neutral-500 hover:text-red-400 flex items-center gap-1 transition-colors">
                                    <Trash2 size={12} /> Clear All
                                </button>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center text-neutral-500 text-xs">You're all caught up</div>
                            ) : (
                                <div className="divide-y divide-neutral-800/50">
                                    {notifications.map(n => (
                                        <div key={n.id} className={`p-4 flex gap-3 ${n.read ? 'opacity-70' : 'bg-white/[0.02]'}`}>
                                            <div className="shrink-0 mt-0.5">
                                                {n.type === 'success' && <CheckCircle2 className="text-emerald-500 w-4 h-4" />}
                                                {n.type === 'error' && <AlertCircle className="text-red-500 w-4 h-4" />}
                                                {n.type === 'info' && <Info className="text-blue-500 w-4 h-4" />}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-white">{n.title}</h4>
                                                {n.message && <p className="text-xs text-neutral-400 mt-0.5">{n.message}</p>}
                                                <p className="text-[10px] text-neutral-500 mt-2">
                                                    {formatDistanceToNow(n.createdAt, { addSuffix: true })}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

                <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-sm font-medium text-white cursor-pointer ml-2">
                    {user?.name?.charAt(0).toUpperCase()}
                </div>
            </div>
        </header>
    )
}