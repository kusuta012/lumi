import { db } from "@/db";
import { media, users, albums, albumMedia, storageBackends } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { getStorageClient } from "@/lib/storage";
import { addMediaToPipe } from "@/lib/queue";
import { cacheInvalid } from "@/lib/cache";
import type { Job } from "bullmq";
import path from "path";
import fs from "fs/promises"
import os from "os";
import { createReadStream } from "fs";
import unzipper from "unzipper";
import crypto from "crypto";

const SUPPORTED_EXT = new Set([
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif", ".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"
])

// omg so many formats ahhh

const SKIP = new Set([
    "metadata.json", "print-subscriptions.json", "shared_album_comments.json",
    "user-generated-memory-title.json", "archive_browser.html"
]);

const B_SIZE = 20;

interface GoogleSidecar {
    title?: string;
    description?: string;
    photoTakenTime?: { timestamp: string; formatted?: string };
    geoData?: { latitude: number; longitude: number; altitude: number };
    geoDataExif?: { latitude: number; longitude: number; altitude: number };
    creationTime?: { timestamp: string };
    favorited?: boolean;
}

interface ExtractedFile {
    relativePath: string;
    diskPath: string;
    albumFolder: string | null;
    sidecar: GoogleSidecar | null;
}

interface ImportStats {
    total: number;
    imported: number;
    duplicates: number;
    skipped: number;
    failed: number;
    albumsCreated: number;
}

export async function GTakeoutImport(job: Job) {
    const { userId, objectKey } = job.data as { userId: string; objectKey: string };

    if (!userId || !objectKey) {
        throw new Error("Missing userId or objectKet in job Data");
    }

    const stats: ImportStats = {
        total: 0, imported: 0, duplicates: 0, skipped: 0, failed: 0, albumsCreated: 0
    };
    const workDir = path.join(os.tmpdir(), `lumi-takeout-${job.id}`);
    await fs.mkdir(workDir, { recursive: true });

    try {
        const defaultBackend = await db.query.storageBackends.findFirst({
            where: eq(storageBackends.isDefault, true)
        });
        const { client, bucket } = getStorageClient(defaultBackend?.config);
        const zipPath = path.join(workDir, "takeout.zip");
        console.log(`download takeout zip from minio`)
        await client.fGetObject(bucket, objectKey, zipPath);
        console.log(`Downloaded succesfully `)
        const extractDir = path.join(workDir, "extracted");
        await extractZip(zipPath, extractDir);
        const files = await catalogFiles(extractDir);
        stats.total = files.length;
        console.log(`found ${files.length} media files to import`);
        if (files.length === 0) {
            console.log("no importable media found in zip");
            return stats;
        }

        const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
            columns: { storageUsed: true, storageQuota: true }
        });
        if (!user) throw new Error("User not found");
        const albumCache = new Map<string, string>();
        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            try {
                const result = await importSinFile(file, userId, client, bucket, defaultBackend?.id || null, albumCache);
                if (result === "imported") stats.imported++;
                else if (result === "duplicate") stats.duplicates++;
                else if (result === "skipped") stats.skipped++;

                if (result === "imported" && file.albumFolder && !albumCache.has(file.albumFolder)) {
                    stats.albumsCreated++;
                }
            } catch (err) {
                console.error(`failed to import ${file.relativePath}:`, err);
                stats.failed++;
            }
            if ((i + 1) % B_SIZE === 0 || i === files.length - 1) {
                const pct = Math.round(((i + 1) / files.length) * 100);
                await job.updateProgress(pct);
                console.log(`progress: ${i + 1}/${files.length} (${pct}%)`);
            }
        }

        await cacheInvalid.onMediaChanged(userId, undefined, true);
        await cacheInvalid.onAlbumChanged(userId);
        console.log("completed google takeout", stats);
        return stats;
    } finally {
        try { await fs.rm(workDir, { recursive: true, force: true }); } catch {}
    }
}

async function extractZip(zipPath: string, destDir: string): Promise<void> {
    await fs.mkdir(destDir, { recursive: true });
    return new Promise((resolve, reject) => {
        createReadStream(zipPath)
            .pipe(unzipper.Extract({ path: destDir }))
            .on("close", resolve)
            .on("finish", resolve)
            .on("error", reject);
    });
}

// life is so tuff, that you barely sleep :pf:

async function catalogFiles(rootDir: string): Promise<ExtractedFile[]> {
    const results: ExtractedFile[] = [];
    const sidecarMap = new Map<string, GoogleSidecar>();
    await walkDir(rootDir, async (filePath) => {
        if (!filePath.endsWith(".json")) return;
        const basename = path.basename(filePath);
        if (SKIP.has(basename)) return;
        
        try {
            const raw = await fs.readFile(filePath, "utf-8");
            const parsed = JSON.parse(raw) as GoogleSidecar;
            if (parsed.photoTakenTime || parsed.geoData || parsed.geoDataExif || parsed.creationTime) {
                const mediaPath = filePath.slice(0, -5);
                sidecarMap.set(mediaPath, parsed);
            }
        } catch {
            // you look sus
        }
    });
    await walkDir(rootDir, async (filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        if (!SUPPORTED_EXT.has(ext)) return;
        const relativePath = path.relative(rootDir, filePath);
        const albumFolder = extractAlbumFolder(relativePath);
        let sidecar = sidecarMap.get(filePath) || null;
        if (!sidecar) {
            const basename = path.basename(filePath);
            const dir = path.dirname(filePath);
            const deNumbered = basename.replace(/\(\d+\)(\.\w+)$/, "$1");
            if (deNumbered !== basename) {
                sidecar = sidecarMap.get(path.join(dir, deNumbered)) || null;
            }

            if (!sidecar && basename.length >= 47) {
                const prefix = basename.slice(0, 46);
                for (const [sidecarPath, sidecarData] of sidecarMap) {
                    if (path.dirname(sidecarPath) === dir && path.basename(sidecarPath).startsWith(prefix)) {
                        sidecar = sidecarData;
                        break;
                    }
                }
            }
        }

        results.push({
            relativePath,
            diskPath: filePath,
            albumFolder,
            sidecar
        });
    });
    return results;
}

async function importSinFile(
    file: ExtractedFile,
    userId: string,
    storageClient: any,
    bucket: string,
    backendId: string | null,
    albumCache: Map<string, string>
): Promise<"imported" | "duplicate" | "skipped"> {
    const filename = path.basename(file.diskPath);
    const ext = path.extname(filename).toLowerCase();
    const mimetype = getMimetype(ext);
    if (!mimetype) return "skipped";
    const fileBuffer = await fs.readFile(file.diskPath);
    const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    const existing = await db.query.media.findFirst({
        where: and(eq(media.hash, hash), eq(media.ownerId, userId))
    });
    if (existing) return "duplicate";
    const fileId = crypto.randomUUID();
    const objectKey = `users/${userId}/${fileId}.${ext.slice(1)}`;
    await storageClient.putObject(bucket, objectKey, fileBuffer, fileBuffer.length, {
        "Content-Type": mimetype
    });

    let dateTaken: Date | null = null;
    let gpsLat: number | null = null;
    let gpsLng: number | null = null;
    let caption: string | null = null;
    let isFavorited = false;

    if (file.sidecar) {
        if (file.sidecar.photoTakenTime?.timestamp) {
            const ts = parseInt(file.sidecar.photoTakenTime.timestamp, 10);
            if (!isNaN(ts) && ts > 0) dateTaken = new Date(ts * 1000);
        } else if (file.sidecar.creationTime?.timestamp) {
            const ts = parseInt(file.sidecar.creationTime.timestamp, 10);
            if (!isNaN(ts) && ts > 0) dateTaken = new Date(ts * 1000);
        }

        const geo = file.sidecar.geoData || file.sidecar.geoDataExif;
        if (geo && geo.latitude !== 0 && geo.longitude !== 0) {
            gpsLat = geo.latitude;
            gpsLng = geo.longitude;
        }

        if (file.sidecar.description) {
            caption = file.sidecar.description;
        }

        if (file.sidecar.favorited) {
            isFavorited = true;
        }
    }

    const sizeInMB = Math.max(1, Math.round(fileBuffer.length / (1024 * 1024)));
    const [newMedia] = await db.insert(media).values({
        ownerId: userId,
        filename,
        mimetype,
        size: fileBuffer.length,
        objectKey,
        hash,
        storageBackendId: backendId,
        dateTaken,
        gpsLat,
        gpsLng,
        caption,
        isFavorited,
    }).returning({ id: media.id });

    await db.update(users)
        .set({ storageUsed: sql`${users.storageUsed} + ${sizeInMB}` })
        .where(eq(users.id, userId));
    
    if (file.albumFolder) {
        let albumId = albumCache.get(file.albumFolder);
        if (!albumId) {
            const existingAlbum = await db.query.albums.findFirst({
                where: and(eq(albums.ownerId, userId), eq(albums.name, file.albumFolder))
            });

            if (existingAlbum) {
                albumId = existingAlbum.id;
            } else {
                const [newAlbum] = await db.insert(albums).values({
                    ownerId: userId,
                    name: file.albumFolder,
                    coverMediaId: newMedia.id
                }).returning({ id: albums.id });
                albumId = newAlbum.id;
            }
            albumCache.set(file.albumFolder, albumId);
        }
        await db.insert(albumMedia).values({
            albumId,
            mediaId: newMedia.id
        }).onConflictDoNothing();
    }
    await addMediaToPipe(newMedia.id);
    return "imported";
}

async function walkDir(dir: string, callback: (filePath: string) => Promise<void>): Promise<void> {
    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return;
    }

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            await walkDir(fullPath, callback);
        } else if (entry.isFile()) {
            await callback(fullPath);
        }
    }
}

function extractAlbumFolder(relativePath: string): string | null {
    const parts = relativePath.split(path.sep);
    let albumIdx = -1;
    for (let i = 0; i < parts.length; i++) {
        if (parts[i].toLowerCase() === "google photos") {
            albumIdx = i + 1;
            break;
        }
    }

    if (albumIdx === -1 && parts.length > 1) {
        albumIdx = 0;
    }

    if (albumIdx === -1 || albumIdx >= parts.length - 1) return null;

    const folderName = parts[albumIdx];

    if (/^Photos from \d{4}$/i.test(folderName)) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(folderName)) return null;

    return folderName;
}

// so many mime types ahhhh
// tf are these names bro "quicktime" huhh? "matroska" waat russian?
function getMimetype(ext: string): string | null {
    const map: Record<string, string> = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp", ".heic": "image/heic",
        ".heif": "image/heif", ".mp4": "video/mp4", ".mov": "video/quicktime", ".avi": "video/x-msvideo", ".mkv": "video/x-matroska",
        ".webm": "video/webm", ".m4v": "video/x-m4v",
    };
    return map[ext] || null;
}
