import { db } from "@/db"
import { media } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/server/auth";
import { date } from "drizzle-orm/pg-core";
import { group } from "console";

export default async function PhotosPage() {
    const session = await auth();
    if (!session?.user?.id) return null;

    const userMedia = await db.query.media.findMany({
        where: eq(media.ownerId, session.user.id),
        orderBy: [desc(media.createdAt)],
    });

    const groupedMedia = userMedia.reduce((acc, item) => {
        const dateKey = (item.createdAt || new Date()).toLocaleDateString('en-US', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
        });
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(item);
        return acc;
    }, {} as Record<string, typeof userMedia>);

    return (
        <div className="p-6 pb-24 relative">
            {Object.keys(groupedMedia).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
                    <p>No Photos yet. Click upload in the top right</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {Object.entries(groupedMedia).map(([date, items]) => (
                        <div key={date}>
                            <h2 className="text-sm font-medium text-neutral-200 mb-4 pl-1">
                                {date}
                            </h2>

                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                                {items.map((item) => (
                                    <div key={item.id} className="relative group aspect-square bg-neutral-900 rounded-lg overflow-hidden cursor-pointer">
                                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                                            <span className="text-xs text-neutral-500 truncate w-full text-center">{item.filename}</span>
                                        </div>
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200" />
                                        <div className="absolute top-2 left-2 w-5 h-5 rounded-full border border-white/50 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <div className="fixed right-2 top-24 bottom-6 w-8 hidden xl:flex flex-col items-center justify-between py-8 text-[10px] text-neutral-500 font-medium z-10 pointer-events-none">
                <span>2034</span>
                <div className="flex-1 w-[1px] bg-neutral-800 my-2 relative">
                    <div className="absolute top-[10%] w-1.5 h-1.5 rounded-full bg-neutral-600 -left-[2.5px]"></div>
                    <div className="absolute top-[40%] w-1.5 h-1.5 rounded-full bg-neutral-600 -left-[2.5px]"></div>
                </div>
                <span>2045</span>
            </div>
        </div>
    );
}