import { db } from "@/db";
import { media } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { auth } from "@/server/auth";
import { cookies } from "next/headers";
import TimelineGallery from "@/components/media/TimelineGallery";
import UnlockLockedFolder from "@/components/locked/UnlockLockedFolder";
import { getPinStatus } from "@/server/actions/locked-actions";

export default async function LockedFolderPage() {
    const session = await auth();
    if (!session?.user?.id) return null;

    const cookieStore = await cookies();
    const isUnlocked = cookieStore.get("lumi_locked_session")?.value === "active";
    const { hasPin } = await getPinStatus();

    if (!isUnlocked || !hasPin) {
        return (
            <div className="min-h-[85vh] flex flex-col items-center justify-center p-4 relative overflow-hidden bg-black">
                <UnlockLockedFolder needsSetup={!hasPin} />
            </div>
        );
    }

    const lockedItems = await db.query.media.findMany({
        where: and(
            eq(media.ownerId, session.user.id),
            eq(media.isDeleted, false),
            eq(media.isLocked, true)
        ),
        orderBy: [desc(media.dateTaken), desc(media.createdAt)]
    });

    const years = lockedItems.map(m => new Date(m.dateTaken || m.createdAt).getFullYear());
    const startYear = years.length > 0 ? Math.max(...years) : new Date().getFullYear();
    const endYear = years.length > 0 ? Math.min(...years) : startYear;

    return (
        <div>
            <div className="px-6 py-8 border-b border-neutral-900">
                <h1 className="text-2xl font-bold text-white tracking-wider">Locked Folder</h1>
            </div>
            <TimelineGallery initialMedia={lockedItems as any} startYear={startYear} endYear={endYear} emptyMessage="Your secure folder is empty" isLockedPage={true} />
        </div>
    );
}