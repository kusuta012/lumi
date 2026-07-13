import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface Props {
    title: string;
    viewAllHref?: string;
    children: React.ReactNode;
}

export default function ExploreSection({ title, viewAllHref, children }: Props) {
    return (
        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    {title}
                </h2>
                {viewAllHref && (
                    <Link
                        href={viewAllHref}
                        className="text-xs font-bold text-orange-500 flex items-center gap-0.5 hover:text-orange-400 transition-colors">
                            View All <ChevronRight size={14} />
                        </Link>
                )}
            </div>
            <div className="w-full">
                {children}
            </div>
        </section>
    );
}