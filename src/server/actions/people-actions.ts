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