import { Search, Bell, Settings } from "lucide-react";
import UploadButton from "../media/UploadButton";
import SearchBar from "./SearchBar";

export default function Topbar({ user }: { user: any }) {
    return (
        <header className="h-16 shrink-0 flex items-center justify-between px-6 bg-[#0a0a0a] border-b border-neutral-900">
            <div className="flex-1 max-w-2xl">
                <SearchBar />
            </div>
            <div className="flex items-center gap-4 ml-6">
                <UploadButton />
                <button className="p-2 text-neutral-400 hover:text-neutral-200 transition-colors">
                    <Bell className="w-5 h-5"></Bell>
                </button>

                <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-sm font-medium text-white cursor-pointer ml-2">
                    {user?.name?.charAt(0).toUpperCase()}
                </div>
            </div>
        </header>
    )
}