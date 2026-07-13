import { db } from "@/db";
import { faces, people } from "@/db/schema";
import { eq, sql, inArray } from "drizzle-orm";
import { cacheInvalid } from "@/lib/cache";
import type { Job } from "bullmq";
import cluster from "cluster";
import { SquareFunctionIcon } from "lucide-react";

const DIST_THRESHOLD = 0.40;
const MAX_NEIGHBORS = 50;
const MAX_CW_ITERATIONS = 30;
const MIN_CLUSTER_SIZE = 2;
const MAX_FACES = 50_000;
const USER_TIMEOUT = 5 * 60 * 1000;
const JOB_TIMEOUT = 30 * 60 * 1000;

interface FaceNode {
    id: string;
    personId: string;
    embedding: number[];
}

export async function faceClustering(job: Job) {
    const jobStart = Date.now();
    const stats = { usersProcessed: 0, usersSkipped: 0, totalClustered: 0, totalMerged: 0, orphansRemoved: 0};
    const usersWithUnknowns = await db.execute(sql`
        SELECT DISTINCT p.owner_id
        FROM ${people} p
        INNER JOIN ${faces} f ON f.person_id = p.id
        WHERE p.name = 'Unknown Person'
          AND f.face_embedding IS NOT NULL
        GROUP BY p.owner_id
        HAVING COUNT(f.id) >= ${MIN_CLUSTER_SIZE}
    `);
    const userIds = (usersWithUnknowns as any[]).map((r: any) => r.owner_id as string);
    for (let i = 0; i < userIds.length; i++) {
        if (Date.now() - jobStart > JOB_TIMEOUT) {
            break;
        }

        const ownerId = userIds[i];
        try {
            const result = await clusterUserFaces(ownerId);
            stats.usersProcessed++;
            stats.totalClustered += result.clustered;
            stats.totalMerged += result.merged;
            stats.orphansRemoved += result.orphansRemoved;

            if (result.clustered > 0) {
                await cacheInvalid.onAimetaChanged(ownerId);
            }
        } catch (err) {
            stats.usersSkipped++;
        }
        await job.updateProgress(Math.round(((i + 1) / userIds.length) * 100));
    }
    return stats;
}

async function clusterUserFaces(ownerId: string) {
    const startTime = Date.now();
    const unknownFaces = await fetchUnknownFaces(ownerId);
    if (unknownFaces.length < MIN_CLUSTER_SIZE) {
        return { clustered: 0, merged: 0, orphansRemoved: 0 };
    }

    const adjacency = await buildAdjacencyGraph(unknownFaces, ownerId, startTime);
    const nodeIds = unknownFaces.map(f => f.id);
    const labels = chineseWhispers(nodeIds, adjacency);

    const clusters = new Map<string, string[]>();
    for (const [nodeId, label] of labels) {
        if (!clusters.has(label)) clusters.set(label, []);
        clusters.get(label)!.push(nodeId);
    }

    let clustered = 0;
    let merged = 0;
    const faceMap = new Map(unknownFaces.map(f => [f.id, f]));

    for (const [, clusterFacesIds] of clusters) {
        if (clusterFacesIds.length < MIN_CLUSTER_SIZE) continue;
        if (Date.now() - startTime > USER_TIMEOUT) {
            break;
        }
        const result = await processCluster(clusterFacesIds, faceMap, ownerId);
        clustered += result.facesReassigned;
        merged += result.personMerged;
    }
    const orphansRemoved = await cleanOrphanedPersons(ownerId);
    return { clustered, merged, orphansRemoved };
}

async function fetchUnknownFaces(ownerId: string): Promise<FaceNode[]> {
    const rows = await db.execute(sql`
        SELECT f.id, f.person_id as "personId", f.face_embedding as "embedding"
        FROM ${faces} f
        INNER JOIN ${people} p ON f.person_id = p.id
        WHERE p.owner_id = ${ownerId}::uuid
          AND p.name = 'Unknown Person'
          AND f.face_embedding IS NOT NULL
        LIMIT ${MAX_FACES}
    `);

    return (rows as any[]).map((r: any) => ({
        id: r.id,
        personId: r.personId,
        embedding: typeof r.embedding === "string" ? JSON.parse(r.embedding) : r.embedding,
    }));
}

async function buildAdjacencyGraph(
    nodes: FaceNode[],
    ownerId: string,
    startTime: number
): Promise<Map<string, Map<string, number>>> {
    const adjacency = new Map<string, Map<string, number>>();
    for (const node of nodes) adjacency.set(node.id, new Map());

    const validIds = new Set(nodes.map(f => f.id));
    for (let i = 0; i < nodes.length; i++) {
        if (Date.now() - startTime > USER_TIMEOUT) break;

        const face = nodes[i];
        const embStr = `[${face.embedding.join(",")}]`;
        const neighbors = await db.execute(sql`
            SELECT f.id, (f.face_embedding <=> ${embStr}::vector) as distance
            FROM ${faces} f
            INNER JOIN ${people} p ON f.person_id = p.id
            WHERE p.owner_id = ${ownerId}::uuid
              AND p.name = 'Unknown Person'
              AND f.id != ${face.id}
              AND f.face_embedding IS NOT NULL
            ORDER BY f.face_embedding <=> ${embStr}::vector
            LIMIT ${MAX_NEIGHBORS}
        `);
        for (const nb of neighbors as any[]) {
            const dist = parseFloat(nb.distance);
            if (dist >= DIST_THRESHOLD) continue;
            if (!validIds.has(nb.id)) continue;
            const similarity = 1.0 - dist;
            adjacency.get(face.id)!.set(nb.id, similarity);
            adjacency.get(nb.id)?.set(face.id, similarity);
        }
    }

    return adjacency;
}

function chineseWhispers(
    nodeIds: string[],
    adjacency: Map<string, Map<string, number>>
): Map<string, string> {
    const labels = new Map<string, string>();
    for (const id of nodeIds) labels.set(id, id);
    for (let iter = 0; iter < MAX_CW_ITERATIONS; iter++) {
        let changed = false;
        const shuffled = [...nodeIds];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        for (const nodeId of shuffled) {
            const neighbors = adjacency.get(nodeId);
            if (!neighbors || neighbors.size === 0) continue;
            const labelWeights = new Map<string, number>();
            for (const [neighborId, similarity] of neighbors) {
                const nLabel = labels.get(neighborId)!;
                labelWeights.set(nLabel, (labelWeights.get(nLabel) || 0) + similarity);
            }

            let bestLabel = labels.get(nodeId)!;
            let bestWeight = -Infinity;
            for (const [label, weight] of labelWeights) {
                if (weight > bestWeight) {
                    bestWeight = weight;
                    bestLabel = label;
                }
            }

            if (bestLabel !== labels.get(nodeId)) {
                labels.set(nodeId, bestLabel);
                changed = true;
            }
        }

        if (!changed) {
            break;
        }
    }

    return labels;
}

async function processCluster(
    clusterFacesIds: string[],
    faceMap: Map<string, FaceNode>,
    ownerId: string
): Promise<{ facesReassigned: number; personMerged: number }> {
    const personIds = [...new Set(
        clusterFacesIds
            .map(id => faceMap.get(id)?.personId)
            .filter((pid): pid is string => pid != null)
    )];

    if (personIds.length <= 1) return { facesReassigned: 0, personMerged: 0 };
    const counts = new Map<string, number>();
    for (const faceId of clusterFacesIds) {
        const pid = faceMap.get(faceId)?.personId;
        if (pid) counts.set(pid, (counts.get(pid) || 0) + 1);
    }
    let winId = personIds[0];
    let maxCount = 0;
    for (const [pid, count] of counts) {
        if (count > maxCount) { maxCount = count; winId = pid; }
    }

    const toReassign = clusterFacesIds.filter(id => faceMap.get(id)?.personId !== winId);
    if (toReassign.length > 0) {
        await db.update(faces)
            .set({ personId: winId })
            .where(inArray(faces.id, toReassign));
    }

    const centId = findCent(clusterFacesIds, faceMap);
    if (centId) {
        await db.update(people)
            .set({ coverFaceId: centId })
            .where(eq(people.id, winId));
    }
    return { facesReassigned: toReassign.length, personMerged: personIds.length - 1 };
}

function findCent(faceIds: string[], faceMap: Map<string, FaceNode>): string | null {
    const embeddings = faceIds
        .map(id => ({ id, emb: faceMap.get(id)?.embedding }))
        .filter((e): e is { id: string; emb: number[] } => e.emb != null);
    
    if (embeddings.length <= 1) return embeddings[0]?.id ?? null;

    let bestId = embeddings[0].id;
    let bestAvg = -Infinity;

    for (const candidate of embeddings) {
        let total = 0;
        for (const other of embeddings) {
            if (candidate.id === other.id) continue;
            total += cos(candidate.emb, other.emb);
        }
        const avg = total / (embeddings.length - 1);
        if (avg > bestAvg) { bestAvg = avg; bestId = candidate.id; }
    }
    return bestId;
}

// ts doesn't know how to find cosine ;-;

function cos(a: number[], b: number[]): number {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    const d = Math.sqrt(na) * Math.sqrt(nb);
    return d === 0 ? 0 : dot / d;
}

async function cleanOrphanedPersons(ownerId: string): Promise<number> {
    const result = await db.execute(sql`
        DELETE FROM ${people}
        WHERE owner_id = ${ownerId}::uuid
          AND name = 'Unknown Person'
          AND id NOT IN (
            SELECT DISTINCT person_id FROM ${faces} WHERE person_id IS NOT NULL
          )    
    `);
    return (result as any)?.rowCount ?? 0;
}