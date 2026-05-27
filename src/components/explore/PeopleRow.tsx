import Link from "next/link";
import { User } from "lucide-react";
import { TopPerson } from "@/server/queries/explore";

interface Props {
    people: TopPerson[];
}

export default function PeopleRow({ people }: Props) {
    return (
        <div className="flex gap-6 overflow-x-auto scrollbar-none pb-2 select-none">
            {people.map((person) => (
                <Link href={`/people/${person.id}`} key={person.id} className="flex-none w-24 text-center group">
                    <div className="aspect-square w-20 mx-auto bg-surface rounded-full overflow-hidden mb-2.5 relative border border-border shadow-md group-hover:border-orange-500/50 group-hover:shadow-lg transition-all duration-300">
                        {person.coverFaceId ? (
                            <img src={`/api/media/faces/${person.coverFaceId}`}
                            alt={person.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted">
                                <User size={24} />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-background/10 opacity-0 group-hover:opacity-10 transition-opacity" />
                    </div>
                    <p className="text-xs font-bold text-foreground group-hover:text-orange-500 transition-colors truncate px-1">
                        {person.name}
                    </p>
                    <p className="text-[10px] text-muted font-semibold mt-0.5 font-mono">
                        {person.faceCount} {person.faceCount === 1 ? "photo" : "photos"}
                    </p>
                </Link>
            ))}
        </div>
    );
}