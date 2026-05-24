import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/server/auth";
import { Settings } from "lucide-react";
import MfaSetup from "@/components/profile/MfaSetup";

export default async function SettingsPg () {
    const session = await auth();
    if (!session?.user?.id) return null;

    const user = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        columns: { mfaEnabled: true }
    }); // I AM HUNGRY I NEDED FOOOD RAADDAWF

    return (
        <div className="p-8 max-w-3xl mx-auto space-y-8 text-foreground">
            <header className="border-b border-border pb-6">
                <h1 className="text-3xl font-black text-foreground flex items-center gap-3 tracking-tight">
                    <Settings className="text-foreground w-8 h-8" /> Account Settings
                </h1>
                <p className="text-muted text-sm mt-2">Manage your profile and other settings</p>
            </header>
            <MfaSetup initialEnabled={Boolean(user?.mfaEnabled)} />
        </div>
    );
}