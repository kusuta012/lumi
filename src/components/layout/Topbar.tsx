"use client";

import { Search, Bell, CheckCircle2, AlertCircle, Info, Trash2, Moon, Sun, LogOut, Settings } from "lucide-react";
import UploadButton from "../media/UploadButton";
import SearchBar from "./SearchBar";
import { useNotification } from "@/components/providers/NotificationProvider";
import { useState, useRef, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import Link from "next/link";

export default function Topbar({ user }: { user: any }) {
    const { notifications, markAllAsRead, clearAll } = useNotification();
    const [isOpen, setIsOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const unreadCount = notifications.filter(n => !n.read).length;
    const { theme, setTheme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsOpen(false);
            if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setIsUserMenuOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleOpen = () => {
        setIsOpen(!isOpen);
        if (!isOpen && unreadCount > 0) markAllAsRead();
    };

    return (
        <header className="h-16 shrink-0 flex items-center justify-between px-6 bg-background border-b border-border z-[1000]">
            <div className="flex-1 max-w-2xl">
                <SearchBar />
            </div>
            <div className="flex items-center gap-4 ml-6">
                <UploadButton />
                {mounted && (
                    <button onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} className="p-2 rounded-full text-muted hover:text-foreground hover:bg-surface-hover transition-colors">
                        {resolvedTheme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                )}
                <div className="relative" ref={menuRef}>
                <button onClick={handleOpen} className={`p-2 rounded-full transition-colors relative ${isOpen ? 'bg-surface-hover text-foreground' : 'text-muted hover:text-foreground'}`}>
                    <Bell className="w-5 h-5"></Bell>
                    {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse border border-background" />
                    )}
                </button>
                {isOpen && (
                    <div className="absolute top-12 right-0 w-80 md:w-96 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-surface">
                            <h3 className="text-foreground font-bold text-sm">Notifications</h3>
                            {notifications.length > 0 && (
                                <button onClick={clearAll} className="text-[10px] font-bold text-muted hover:text-red-400 flex items-center gap-1 transition-colors">
                                    <Trash2 size={12} /> Clear All
                                </button>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center text-muted text-xs">You're all caught up</div>
                            ) : (
                                <div className="divide-y divide-border/50">
                                    {notifications.map(n => (
                                        <div key={n.id} className={`p-4 flex gap-3 ${n.read ? 'opacity-70' : 'bg-surface-hover'}`}>
                                            <div className="shrink-0 mt-0.5">
                                                {n.type === 'success' && <CheckCircle2 className="text-emerald-500 w-4 h-4" />}
                                                {n.type === 'error' && <AlertCircle className="text-red-500 w-4 h-4" />}
                                                {n.type === 'info' && <Info className="text-blue-500 w-4 h-4" />}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-foreground">{n.title}</h4>
                                                {n.message && <p className="text-xs text-muted mt-0.5">{n.message}</p>}
                                                <p className="text-[10px] text-muted mt-2">
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
            <div className="relative" ref={userMenuRef}>
                <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-sm font-medium text-foreground cursor-pointer ml-2 transition-colors border border-border">
                    {user?.image ? (
                        <img src={user.image} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        <span className="w-full h-full bg-orange-500 flex items-center justify-center hover:bg-orange-400 transition-colors">
                            {user?.name?.charAt(0).toUpperCase()}
                        </span>
                    )}
                </button>
            {isUserMenuOpen && (
                <div className="absolute top-11 right-0 w-52 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-4 py-3 border-b border-border">
                        <p className="text-sm font-bold text-foreground truncate">{user?.name}</p>
                        <p className="text-[10px] text-muted truncate">{user?.email}</p>
                    </div>
                    <div className="p-1">
                        <Link href="/settings" onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-surface-hover rounded-lg transition-colors">
                            <Settings size={15} className="text-muted" />
                            Settings
                        </Link>
                        <button
                            onClick={() => signOut({ callbackUrl: "/login" })} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                                <LogOut size={15} />
                                Sign out
                            </button>
                    </div>
                </div>
            )}
        </div>
        </div>
        </header>
    )
}