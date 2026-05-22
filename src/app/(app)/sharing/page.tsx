import { db } from "@/db";
import { albums, albumContributors } from "@/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { auth } from "@/server/auth";
import AlbumCard from "@/components/albums/AlbumCard";
import Link from "next/link";
import { Link2, Plus } from "lucide-react";

export default async function SharingPage() {
  const session = await auth();
  if (!session?.user?.id) return null; // FAHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH
  const contributions = await db.query.albumContributors.findMany({
    where: eq(albumContributors.userId, session.user.id),
  });
  const sharedWithMeIds = contributions.map((c) => c.albumId);
  const sharedWithMe =
    sharedWithMeIds.length > 0
      ? await db.query.albums.findMany({
          where: inArray(albums.id, sharedWithMeIds),
        })
      : [];

  return (
    <div className="p-8 space-y-12 text-neutral-200">
      <header className="flex justify-between items-center border-b border-neutral-900 pb-6 shrink-0">
        <h1 className="text-xl font-bold text-white tracking-wider">Sharing</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/albums"
            className="flex items-center gap-2 px-4 py-2 border border-neutral-800 hover:border-orange-500 bg-neutral-900/50 hover:bg-orange-500/5 rounded-lg text-xs font-bold transition-all">
                <Plus size={14} className="text-orange-500" /> Create album
          </Link>
          <Link href="/sharing/shared-links" className="flex items-center gap-2 px-4 py-2 border border-neutral-800 hover:border-orange-500 bg-neutral-900/50 hover:bg-orange-500/5 rounded-lg text-xs font-bold transition-all">
                <Link2 size={14} className="text-orange-500" /> Shared links
          </Link>
        </div>
      </header>

      <section className="space-y-6">
        <h2 className="text-sm font-black text-neutral-400 tracking-widest pl-1">
            Albums
        </h2> 
        {sharedWithMe.length === 0 ? (
            <div className="border border-neutral-900 border-dashed p-12 text-center text-xs text-neutral-600 rounded-2xl">
                No albums shared with you yet.
            </div>
        ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {sharedWithMe.map(album => (
                    <AlbumCard key={album.id} album={album} />
                ))}
            </div>
        )}
      </section>
    </div>
  );
}
