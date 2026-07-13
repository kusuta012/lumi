import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { getStorageClient } from "@/lib/storage";
import { db } from "@/db";
import { users, storageBackends, media } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";

const prepUserCheck = db
  .select({
    storageUsed: users.storageUsed,
    storageQuota: users.storageQuota,
  })
  .from(users)
  .where(eq(users.id, sql.placeholder("userId")))
  .prepare("user_quota_check");

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { filename, fileSize, contentType, fileHash, intent } =
      await req.json();
    const isMedia =
      contentType?.startsWith("image/") || contentType?.startsWith("video/");
    const isZip =
      contentType === "application/zip" ||
      contentType === "application/x-zip-compressed" ||
      filename.endsWith(".zip");

    if (intent === "takeout") {
      if (!isZip)
        return NextResponse.json(
          { error: "Only .zip files are allowed for imports" },
          { status: 400 },
        );
    } else {
      if (!isMedia)
        return NextResponse.json(
          { error: "invalid file type. Only images and video are allowed." },
          { status: 400 },
        );
    }

    if (fileHash) {
      const existingMedia = await db.query.media.findFirst({
        where: and(
          eq(media.hash, fileHash),
          eq(media.ownerId, session.user.id),
        ),
      });

      if (existingMedia) {
        const [newMedia] = await db
          .insert(media)
          .values({
            ownerId: session.user.id,
            filename: filename,
            mimetype: existingMedia.mimetype,
            size: existingMedia.size,
            objectKey: existingMedia.objectKey,
            hash: existingMedia.hash,
            thumbnails: existingMedia.thumbnails,
            storageBackendId: existingMedia.storageBackendId,
            clipEmbedding: existingMedia.clipEmbedding,
            extractedText: existingMedia.extractedText,
            hoverSpriteKey: existingMedia.hoverSpriteKey,
            hlsPlaylistKey: existingMedia.hlsPlaylistKey,
            blurScore: existingMedia.blurScore,
          })
          .returning({ id: media.id });
        return NextResponse.json({
          isDuplicate: true,
          mediaId: newMedia.id,
          message: "File duplicated",
        });
      }
    }

    const [user] = await prepUserCheck.execute({ userId: session.user.id });

    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const incomingMB = fileSize / (1024 * 1024);
    const usedMB = user.storageUsed || 0;
    const limitMB = user.storageQuota || 0;

    if (usedMB + incomingMB > limitMB) {
      return NextResponse.json(
        {
          error: "Storage quota exceeded",
          message: `You need ${incomingMB.toFixed(2)}MB but only have ${(limitMB - usedMB).toFixed(2)}MB left`,
        },
        { status: 403 },
      );
    }

    const defaultBackend = await db.query.storageBackends.findFirst({
      where: eq(storageBackends.isDefault, true),
    });

    const { client, bucket } = getStorageClient(defaultBackend?.config);

    const bucketExists = await client.bucketExists(bucket);
    if (!bucketExists) await client.makeBucket(bucket);

    const fileId = crypto.randomUUID();
    const ext = filename.split(`.`).pop();
    const objectKey = `users/${session.user.id}/${fileId}.${ext}`;
    const presignedUrl = await client.presignedPutObject(
      bucket,
      objectKey,
      3600,
    );

    return NextResponse.json({
      presignedUrl,
      objectKey,
      backendId: defaultBackend?.id || null,
    });
  } catch (err) {
    console.error("presigned url error", err);
    return NextResponse.json(
      { error: "failed to generate presigned url" },
      { status: 500 },
    );
  }
}
