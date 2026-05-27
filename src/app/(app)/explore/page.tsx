import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { Users, Sparkles, ImageOff } from "lucide-react";
import ExploreSection from "@/components/explore/ExploreSection";
import PeopleRow from "@/components/explore/PeopleRow";
import RcntHighlights from "@/components/explore/RcntHighlights";
import { getTopPeople, getRcntHighlights } from "@/server/queries/explore";

export default async function ExplorePg() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/login");
    }

    const userId = session.user.id;

    const [TopPerson,rcntHighlights] = await Promise.all([
        getTopPeople(userId),
        getRcntHighlights(userId)
    ]);
    const hasData = TopPerson.length > 0 || rcntHighlights.length > 0;
    return (
        <div className="p-8 pb-24 space-y-12">
            <header className="pb-6 border-b border-border">
                <h1 className="text-3xl font-bold text-foreground">Explore</h1>
            </header>
            {!hasData ? (
                <div className="h-96 flex flex-col items-center justify-center border border-dashed border-border rounded-3xl text-muted animate-in fade-in duration-300">
                    <ImageOff size={48} className="mb-4 opacity-15" />
                    <p className="text-lg font-medium text-muted">No explore data available yet</p>
                </div>
            ) : (
                <div className="space-y-12">
                    {TopPerson.length > 0 && (
                        <ExploreSection title="People" viewAllHref="/people">
                        <PeopleRow people={TopPerson} />
                        </ExploreSection>
                    )}

                    {rcntHighlights.length > 0 && (
                        <ExploreSection title="Recent Highlights">
                                <RcntHighlights highlights={rcntHighlights} />
                            </ExploreSection>
                    )}
                </div>
            )}
        </div>
    )
}