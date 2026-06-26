"use server";

import { db } from "@/db";
import { people, faces } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/server/auth";

export async function renamePerson(personId: string, name: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        await db.update(people)
            .set({ name })
            .where(and(eq(people.id, personId), eq(people.ownerId, session.user.id)));
        return { success: true };
    } catch (err) {
        console.error("Failed to rename person", err);
        return { success: false, error: "failed to rename person" };
    }
}

export async function mergePeople(targetPersonId: string, sourcePersonId: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const target = await db.query.people.findFirst({
            where: and(eq(people.id, targetPersonId), eq(people.ownerId, session.user.id))
        });
        const source = await db.query.people.findFirst({
            where: and(eq(people.id, sourcePersonId), eq(people.ownerId, session.user.id))
        });
        if (!target || !source) {
            return { success: false, error: "Invalid target or source profile" };
        }

        await db.update(faces)
            .set({ personId: targetPersonId })
            .where(eq(faces.personId, sourcePersonId));

        await db.delete(people)
            .where(eq(people.id, sourcePersonId));

        return { success: true };
    } catch (err) {
        console.error("Failed to merge people profiles", err);
        return { success: false, error: "Failed to merge people profiles" };
    }
}

export async function toggleHidePerson(personId: string, isHidden: boolean) {
    const session = await auth();
    if (!session?.user.id) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        await db.update(people)
            .set({ isHidden })
            .where(and(eq(people.id, personId), eq(people.ownerId, session.user.id)));
        return { success: true };
    } catch (err) {
        console.error("Failed to toggle hide status:", err);
        return { success: false, error: "Failed to toggle hide stauts" };
    }
}

export async function removeFaceFromPerson(faceId: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const face = await db.query.faces.findFirst({
            where: eq(faces.id, faceId),
            with: { person: true }
        });

        if (!face?.person || face.person.ownerId !== session.user.id) {
            return { success: false, error: "Face not found" };
        }
        const oldPersonId = face.personId;

        await db.update(faces)
            .set({ personId: null })
            .where(eq(faces.id, faceId));

        if (oldPersonId && face.person.coverFaceId === faceId) {
            const nextFace = await db.query.faces.findFirst({
                where: eq(faces.personId, oldPersonId)
            });
            await db.update(people)
                .set({ coverFaceId: nextFace?.id || null })
                .where(eq(people.id, oldPersonId));
        }

        if (oldPersonId) {
            const remaining = await db.query.faces.findFirst({
                where: eq(faces.personId, oldPersonId)
            });
            if (!remaining) {
                await db.delete(people).where(eq(people.id, oldPersonId));
            }
        }

        return { success: true };
    } catch (err) {
        console.error("Failed to remove face", err);
        return { success: false, error: "Failed to remove face" };
    }
}

export async function reassignFace(faceId: string, targetPersonId: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const face = await db.query.faces.findFirst({
            where: eq(faces.id, faceId),
            with: { person: true }
        });

        if (!face) return { success: false, error: "Face not found" };

        const targetPerson = await db.query.people.findFirst({
            where: and(eq(people.id, targetPersonId), eq(people.ownerId, session.user.id))
        });

        if (!targetPerson) return { success: false, error: "Target person not found" };

        const oldPersonId = face.personId;

        await db.update(faces)
            .set({ personId: targetPersonId })
            .where(eq(faces.id, faceId));
        
        if (!targetPerson.coverFaceId) {
            await db.update(people)
                .set({ coverFaceId: faceId })
                .where(eq(people.id, targetPersonId));
        }

        if (oldPersonId) {
            if (face.person?.coverFaceId === faceId) {
                const nextFace = await db.query.faces.findFirst({
                    where: eq(faces.personId, oldPersonId)
                });
                await db.update(people)
                    .set({ coverFaceId: nextFace?.id || null })
                    .where(eq(people.id, oldPersonId));
            }

            const remaining = await db.query.faces.findFirst({
                where: eq(faces.personId, oldPersonId)
            });
            if (!remaining) {
                await db.delete(people).where(eq(people.id, oldPersonId));
            }
        }

        return { success: true };
    } catch (err) {
        console.error("failed to reassign face", err);
        return { success: false, error: "Failed to reassign face" };
    }
}

export async function getFacesForMedia(mediaId: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, face: [] };
    }

    const mediaFaces = await db.query.faces.findMany({
        where: eq(faces.mediaId, mediaId),
        with: { person: true }
    });

    return {
        success: true,
        faces: mediaFaces.map(f => ({
            id: f.id,
            boundingBox: f.boundingBox,
            personId: f.personId,
            personName: f.person?.name || null,
        }))
    };
}