import Link from "next/link";
import {
    Image as ImageIcon, Search, Map, Users, Heart, Library, Archive, Lock, Trash2, Info
} from "lucide-react";

export default function Sidebar() {
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
    ];

    return (
        <aside className="w-64-bg-[#0a0a0a] flex flex-col border-r border-neutral-900 h-full">
            <div className="h-16 flex items-center px-6 gap-3 shrink-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-green-500 flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-lg">L</span>
                </div>
                <span className="text-xl font-bold tracking-tight text-neutral-100">Lumi</span>
            </div>
            <div className="flex-1 overflow-y-auto py-4 px-3 space-y-8 custom-scrollbar">
                <nav className="space-y-1">
                    {navItems.map((item) => (
                        <Link key={item.label} href={item.href} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${item.active ? 'bg-neutral-800/80 text-blue-400' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'}`}>
                            <item.icon className="w-5 h-5"/>
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div>
                    <h3 className="px-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Library</h3>
                    <nav className="space-y-1">
                        {libraryItems.map((item) => (
                            <Link key={item.label} href={item.href} className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200">
                                <item.icon className="w-5 h-5" />
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </div>
            </div>

            <div className="p-4 border-t border-neutral-900 shrink-0">
                <div className="bg-neutral-900 rounded-lg p-4">
                    <p className="text-xs font-medium text-neutral-300 mb-1">Storage Space</p>
                    <p className="text-[10px] text-neutral-500 mb-2">00g used 100gbs placeholder</p>
                    <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                        <div className="bg-orange-500 w-1/12 h-full rounded-full"></div>
                    </div>
                </div>
                <div className="flex items-center justify-between mt-4 text-[10px] text-neutral-500 px-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500">
                        Server Online
                    </span>
                    <Info className="w-4 h-4 cursor-pointer hover:text-neutral-300" />
                </div>
            </div>
        </aside>
    );
}