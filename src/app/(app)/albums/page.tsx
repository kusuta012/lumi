import { db } from "@/db"
import { eq, and, desc } from "drizzle-orm";
import { albums } from "@/db/schema";
import { auth } from "@/server/auth";
import Link from "next/link";
import { Library } from "lucide-react";

export default async function AlbumsPage() {
    const session  = await auth();
    if (!session?.user?.id) return null;

    const userAlbums = await db.query.albums.findMany({
        where: eq(albums.ownerId, session.user.id),
        orderBy: [desc(albums.createdAt)],
    });

    return (
        <div className="p-8">
            <header className="mb-10">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Library className="text-orange-500 w-5 h-5"/>
                    Albums
                </h1>
                <p className="text-neutral-500 text-sm mt-2">Your Collections</p>
            </header>

            {userAlbums.length === 0 ? (
                <div className="h-80 flex flex-col items-center justify-center border-2 border-dashed border-neutral-900 rounded-3xl text-neutral-500">
                    <Library size={48} className="mb-4 opacity-10" />
                    <p className="text-lg font-medium text-neutral-400">No albums yet !</p>
                    <p className="text-sm">Select photos in your gallery to create one</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
                    {userAlbums.map((album) => (
                        <Link href={`/albums/${album.id}`} key={album.id} className="group">
                            <div className="aspect-square bg-neutral-900 rounded-2xl overflow-hidden mb-4 relative border border-neutral-800 shadow-lg group-hover:border-orange-500/50 transition-all">
                                {album.coverMediaId ? (
                                    <img src={`/api/media/${album.coverMediaId}?size=medium`} alt={album.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-neutral-700">
                                        <Library size={40} />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                            </div>
                            <h3 className="text-sm font-bold text-neutral-200 group-hover:text-orange-500 transition-colors truncate">
                                {album.name}
                            </h3>
                            <p className="text-xs text-neutral-500 mt-1 uppercase tracking-widest">Album</p>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}