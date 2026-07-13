import { db } from "@/db";
import { albums, albumContributors } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export type AlbumRole = 'owner' | 'co_owner' | 'contributor' | 'viewer' | 'none';

const ROLE_LEVELS = {
    none: 0,
    viewer: 1,
    contributor: 2,
    co_owner: 3,
    owner: 4
};

export async function getAlbumRole(albumId: string, userId: string): Promise<AlbumRole> {
    const album = await db.query.albums.findFirst({ where: eq(albums.id, albumId) });

    if (!album) return 'none';
    if (album.ownerId === userId) return 'owner';

    const contrib = await db.query.albumContributors.findFirst({
        where: and(eq(albumContributors.albumId, albumId), eq(albumContributors.userId, userId))
    });

    if (contrib) {
        return contrib.role as AlbumRole;
    }

    return 'none';
}

export function hasPermission(currentRole: AlbumRole, requiredLevel: 'view' | 'contribute' | 'manage' | 'delete'):
boolean {
    const requirements = {
        view: 1,
        contribute: 2,
        manage: 3,
        delete: 4
    };

    return ROLE_LEVELS[currentRole] >= requirements[requiredLevel];
}