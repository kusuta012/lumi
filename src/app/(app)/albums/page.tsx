import { db } from "@/db"
import { eq, and, desc } from "drizzle-orm";
import { albums } from "@/db/schema";
import { auth } from "@/server/auth";
import { Library} from "lucide-react";
import CreateAlbumButton from "@/components/albums/CreateAlbumButton";
import AlbumCard from "@/components/albums/AlbumCard";

export default async function AlbumsPage() {
    const session  = await auth();
    if (!session?.user?.id) return null;

    const userAlbums = await db.query.albums.findMany({
        where: eq(albums.ownerId, session.user.id),
        orderBy: [desc(albums.createdAt)],
    });

    return (
        <div className="p-8">
            <header className="mb-10 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Library className="text-orange-500 w-5 h-5"/> Albums
                    </h1>
                    <p className="text-neutral-500 text-sm mt-2">Your Collections</p>
                </div>
                <CreateAlbumButton />
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
                        <AlbumCard key={album.id} album={album} />
                    ))}
                </div>
            )}
        </div>
    )
}