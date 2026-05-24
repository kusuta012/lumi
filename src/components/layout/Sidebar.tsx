"use client";

import Link from "next/link";
import {
    Image as ImageIcon, Search, Map, Users, Heart, Library, Archive, Lock, Trash2, Info, Hammer, Settings
} from "lucide-react";
import { usePathname } from "next/navigation";

interface SidebarProps {
    userRole?: string;
    storageUsed?: number;
    storageQuota?: number;
}

export default function Sidebar({ userRole, storageUsed = 0, storageQuota = 5120 }: SidebarProps) {
    const pathname = usePathname();
    const navItems = [
        { icon: ImageIcon, label: "Photos", href: "/photos", active: true },
        { icon: Search, label: "Explore", href: "/explore" },
        { icon: Map, label: "Map", href: "/map" },
        { icon: Users, label: "Sharing", href: "/sharing" },
    ];

    const libraryItems = [
        { icon: Heart, label: "Favorites", href: "/favorites" },
        { icon: Library, label: "Albums", href: "/albums" },
        { icon: Archive, label: "Archive", href: "/archives" },
        { icon: Lock, label: "Locked Folder", href: "/locked" },
        { icon: Trash2, label: "Trash", href: "/trash" },
        { icon: Settings, label: "Settings", href: "/settings"},
    ];
    const isActive = (path: string) => pathname === path;
    const percentUsed = Math.min(100, (storageUsed / storageQuota) * 100);

    return (
        <aside className="w-64 bg-surface flex flex-col border-r border-border h-full">
            <div className="h-16 flex items-center px-6 gap-3 shrink-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-green-500 flex items-center justify-center shadow-lg">
                    <span className="text-foreground font-bold text-lg">L</span>
                </div>
                <span className="text-xl font-bold tracking-tight text-foreground">Lumi</span>
            </div>
            <div className="flex-1 overflow-y-auto py-4 px-3 space-y-8 custom-scrollbar">
                <nav className="space-y-1">
                    {navItems.map((item) => (
                        <Link key={item.label} href={item.href} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${isActive(item.href) ? 'bg-surface-hover/80 text-orange-400' : 'text-muted hover:bg-surface hover:text-foreground'}`}>
                            <item.icon className="w-5 h-5"/>
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div>
                    <h3 className="px-3 text-xs font-semibold text-muted uppercase tracking-wider mb-2">Library</h3>
                    <nav className="space-y-1">
                        {libraryItems.map((item) => (
                            <Link key={item.label} href={item.href} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${isActive(item.href) ? 'bg-orange-500/10 text-orange-500' : 'text-muted hover:bg-surface hover:text-foreground'}`}>
                                <item.icon className="w-5 h-5" />
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </div>
            </div>

            {userRole === "Super Admin" && (
                <div>
                    <nav className="space-y-1">
                        <Link href="/admin" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${isActive("/admin") ? 'bg-orange-500/10 text-orange-500' : 'text-muted hover:bg-surface hover:text-foreground'}`}>
                            <Hammer className="w-5 h-5" /> Admin
                        </Link>
                    </nav>
                </div>
            )}

            <div className="p-4 border-t border-border shrink-0">
                <div className="bg-surface-hover border border-border rounded-xl p-4 shadow-sm">
                    <p className="text-xs font-medium text-foreground mb-1">Storage Space</p>
                    <p className="text-[10px] text-muted mb-2">{(storageUsed / 1024).toFixed(2)} GB / {(storageQuota / 1024).toFixed(2)} GB</p>
                    <div className="w-full h-1.5 bg-background/50 border border-border rounded-full overflow-hidden">
                        <div className="bg-orange-500 h-full transition-all duration-1000" style={{ width: `${percentUsed}%` }} />
                    </div>
                </div>
                <div className="flex items-center justify-between mt-4 text-[10px] text-muted px-1">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <span className="text-muted tracking-wider text-[10px]">
                            Server Online
                        </span>
                    </div>
                    <Info className="w-4 h-4 cursor-pointer hover:text-foreground" />
                </div>
            </div>
        </aside>
    );
}