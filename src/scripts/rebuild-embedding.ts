// I making this script just to rebuild my db as it already has lots of images so it would be better to test the existing instead of wiping all existing records and doing all over again. :)

import { db } from "@/db";
import { media, faces, people } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getStorageClient } from "@/lib/storage";
import { env } from "@/lib/env";
import "dotenv/config";

async function reb() {
    const items = await db.query.media.findMany({
        where: sql`${media.isDeleted} IS NOT TRUE`,
        with: { storageBackend: true }
    });

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const { client, bucket } = getStorageClient(item.storageBackend?.config);

        try {
            const thumbKey = (item.thumbnails as any)?.small || item.objectKey;

            const stream = await client.getObject(bucket, thumbKey);
            const chunks: Buffer[] = [];
            for await (const chunk  of stream) {
                chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
            }
            const buffer = Buffer.concat(chunks);
            const formData = new FormData();
            formData.append("file", new Blob([new Uint8Array(buffer)]), "image.jpg");

            const aiResponse = await fetch(`${env.ML_API_URl}/analyze/image`, {
                method: "POST",
                body: formData as any,
            });

            if (!aiResponse.ok) {
                console.error(`failed to analyze image ${item.filename}`, aiResponse.statusText);
                continue;
            }

            const aiData = await aiResponse.json();
            await db.delete(faces).where(eq(faces.mediaId, item.id));

            await db.update(media)
                .set({
                    clipEmbedding: aiData.clipEmbedding,
                    extractedText: aiData.extractedText || null,
                    blurScore: aiData.blurScore
                })
                .where(eq(media.id, item.id));
            const detectedFaces = aiData.faces || [];
            if (detectedFaces.length > 0) {
                for (const face of detectedFaces) {
                    const embeddingStr = `[${face.embedding.join(`,`)}]`;
                    const result = await db.execute(sql`
                        SELECT person_id, (face_embedding <=> ${embeddingStr}::vector) AS distance
                        FROM ${faces}
                        WHERE face_embedding IS NOT NULL
                        ORDER BY distance ASC
                        LIMIT 1    
                    `);

                    let personId: string;
                    const clsMatch = result[0] as { person_id: string, distance: number } | undefined;

                    if (clsMatch && clsMatch.distance < 0.40) {
                        personId = clsMatch.person_id;
                    } else {
                        const newPerson = await db.insert(people).values({
                            ownerId: item.ownerId,
                            name: "Unknown Person"
                        }).returning({ id: people.id });
                        personId = newPerson[0].id
                    }

                    const insertedFace = await db.insert(faces).values({
                        mediaId: item.id,
                        personId: personId,
                        boundingBox: face.boundingBox,
                        faceEmbedding: face.embedding
                    }).returning({ id: faces.id });

                    await db.execute(sql`
                        UPDATE ${people} SET cover_face_id = ${insertedFace[0].id}
                        WHERE id = ${personId} AND cover_face_id IS NULL    
                    `);
                }
            }
            console.log(`updated embedding ${item.filename}`);
        } catch (err) {
            console.error(`error processing ${item.filename}`, err);
        }
    }
    console.log("completed")
    process.exit(0);
}

reb().catch(console.error);