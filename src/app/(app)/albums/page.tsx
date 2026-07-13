import { db } from "@/db"
import { eq, and, desc, sql } from "drizzle-orm";
import { albumContributors, albums } from "@/db/schema";
import { auth } from "@/server/auth";
import { Library} from "lucide-react";
import CreateAlbumButton from "@/components/albums/CreateAlbumButton";
import AlbumCard from "@/components/albums/AlbumCard";
import { redisCache } from "@/lib/cache";

export default async function AlbumsPage() {
    const session  = await auth();
    if (!session?.user?.id) return null;

    const cacheKey = `user_albums_grid:${session.user.id}`;
    let userAlbums = await redisCache.get(cacheKey);

    if (!userAlbums) {
        const ownedPromise = db.select({
            id: albums.id,
            name: albums.name,
            description: albums.description,
            coverMediaId: albums.coverMediaId,
            ownerId: albums.ownerId,
            createdAt: albums.createdAt,
            role: sql<string>`'owner'`,
        })
        .from(albums)
        .where(eq(albums.ownerId, session.user.id))
        
        const contributedPromise = db.select({
            id: albums.id,
            name: albums.name,
            description: albums.description,
            coverMediaId: albums.coverMediaId,
            ownerId: albums.ownerId,
            createdAt: albums.createdAt,
            role: albumContributors.role,
        })
        .from(albums)
        .innerJoin(albumContributors, eq(albumContributors.albumId, albums.id))
        .where(eq(albumContributors.userId, session.user.id));

        const [owned, contributed] = await Promise.all([ownedPromise, contributedPromise]);

        userAlbums = [...owned, ...contributed].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        await redisCache.set(cacheKey, userAlbums, 3600);
    }

    userAlbums = userAlbums.map((a: any) => ({ ...a, createdAt: new Date(a.createdAt) }));

    return (
        <div className="p-8">
            <header className="mb-10 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                        <Library className="text-orange-500 w-5 h-5"/> Albums
                    </h1>
                    <p className="text-muted text-sm mt-2">Your Collections</p>
                </div>
                <CreateAlbumButton />
            </header>

            {userAlbums.length === 0 ? (
                <div className="h-80 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-3xl text-muted">
                    <Library size={48} className="mb-4 opacity-10" />
                    <p className="text-lg font-medium text-muted">No albums yet !</p>
                    <p className="text-sm">Select photos in your gallery to create one</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
                    {userAlbums.map((album: any) => (
                        <AlbumCard key={album.id} album={album} role={album.role} />
                    ))}
                </div>
            )}  
        </div>
    )
}