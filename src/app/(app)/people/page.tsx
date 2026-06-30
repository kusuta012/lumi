import { db } from "@/db";
import { sql } from "drizzle-orm";
import { faces, people } from "@/db/schema";
import { auth } from "@/server/auth";
import { Users } from "lucide-react";
import PersonCard from "@/components/people/PersonCard";
import { redirect } from "next/navigation";

interface PersonRow {
    id: string;
    name: string;
    coverFaceId: string | null;
    faceCount: number,
}

export default async function PeoplePg() {
    const session = await auth();
    if (!session?.user?.id) return null;

    const result = await db.execute(sql`
        SELECT p.id, p.name, p.cover_face_id as "coverFaceId", count(f.id)::int as "faceCount"
        FROM ${people} p
        INNER JOIN ${faces} f ON f.person_id = p.id
        INNER JOIN media m ON f.media_id = m.id
        WHERE p.owner_id = ${session.user.id}::uuid 
            AND p.is_hidden = false
            AND m.is_deleted = false
            AND m.is_locked = false
        GROUP BY p.id, p.name, p.cover_face_id
        ORDER BY "faceCount" DESC   
    `);

    const userPeople = (result as any) as PersonRow[];

    return (
        <div className="p-8">
            <header className="mb-10 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                        <Users className="text-orange-500 w-5 h-5" /> People
                    </h1>
                    <p className="text-muted text-sm mt-2">Recognized faces inside your media</p>
                </div>
            </header>

            {userPeople.length === 0 ? (
                <div className="h-80 flex flex-col items-center justify-center border-2 border-border rounded-3xl text-muted">
                    <p className="text-lg font-medium text-muted">No Recognized people yet</p>
                    <p className="text-sm">Upload photos with faces, and they will automatically cluseter here</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
                    {userPeople.map((person) => (
                        <PersonCard key={person.id} person={person} allPeople={userPeople} />
                    ))}
                </div>
            )}
        </div>
    );
}