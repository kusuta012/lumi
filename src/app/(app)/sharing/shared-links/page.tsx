import { db } from "@/db";
import { shareLinks, albums, media } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { auth } from "@/server/auth";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { format } from "date-fns";
import { CopyLink, DeleteLink } from "@/components/sharing/LinkActionsButton";

export default async function SharedLinks() {
    const session = await auth();
    if (!session?.user?.id) return null;
    const links = await db.query.shareLinks.findMany({
        where: eq(shareLinks.ownerId, session.user.id),
        orderBy: [desc(shareLinks.createdAt)]
    });

    const resolvedLinks = await Promise.all(links.map(async (link) => {
        let name = "Shared Item";
        let coverId = null;

        if (link.targetType === 'album') {
            const alb = await db.query.albums.findFirst({
                where: eq(albums.id, link.targetId)
            });
            name = alb?.name || "Deleted Album";
            coverId = alb?.coverMediaId;
        } else {
            const med = await db.query.media.findFirst({ where: eq(media.id, link.targetId) });
            name = med?.filename || "Deleted Media";
            coverId = med?.id;
        }
        return { ...link, name, coverId };
    }));

    return (
        <div className="p-8 space-y-8 text-foreground">
            <Link href="/sharing" className="flex items-center gap-2 text-muted hover:text-orange-500 transition-colors text-sm font-bold tracking-tight">
                <ArrowLeft size={16} /> Back to Sharing
            </Link>
            <header className="border-b border-border pb-6">
                <h1 className="text-xl font-bold text-foreground tracking-wider">Shared Links</h1>
                <p className="text-muted text-xs mt-2 font-bold tracking-widest">Active links</p>
            </header>

            {resolvedLinks.length === 0 ? (
                <p className="text-xs text-muted bg-background border border-border p-6 rounded-xl border-dashed">
                    You haven't generated any shared links yet
                </p>
            ) : (
                <div className="border border-border bg-background rounded-2xl overflow-hidden divide-y divide-border">
                    {resolvedLinks.map((link) => {
                        const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date();

                        return (
                            <div key={link.id} className="p-4 flex items-center justify-between gap-6 hover:bg-surface/10 transition-colors">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-12 h-12 rounded-lg bg-surface border border-border shrink-0 overflow-hidden">
                                        {link.coverId ? (
                                            <img src={`/api/media/${link.coverId}?size=small`} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted">
                                                <Clock size={16}></Clock>
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-mono text-muted tracking-widest flex items-center gap-1.5">
                                            Expires: {link.expiresAt ? format(new Date(link.expiresAt), "dd MM yyyy") : "∞"}
                                            {isExpired && <span className="text-red-500 font-bold ml-1">(EXPIRED)</span>}
                                        </p>
                                        <h3 className="text-sm font-bold text-foreground mt-1 truncate max-w-wd">{link.name}</h3>
                                        <div className="flex gap-1.5 mt-2">
                                            {link.allowUpload && <span className="text-[9px] font-bold bg-orange-500/10 text-orange-500 border border-orange-500/20 px-1.5 py-0/5 rounded">UPLOAD</span>}
                                            {link.allowDownload && <span className="text-[9px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20 px-1.5 py-0/5 rounded">DOWNLOAD</span>}
                                            {link.requireLogin && <span className="text-[9px] font-bold bg-orange-500/10 text-orange-500 border border-orange-500/20 px-1.5 py-0/5 rounded">AUTH</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <CopyLink token={link.linkToken} />
                                    <DeleteLink linkId={link.id} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
