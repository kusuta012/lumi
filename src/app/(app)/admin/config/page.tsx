import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import VideoTranscode from "@/components/admin/VideoTranscode";
import AiModelSettings from "@/components/admin/AiModelSettings";
import { getVidTranscodeSettings, getAiSettings } from "@/server/actions/config-actions";

export default async function ConfigPg() {
    const session = await auth();
    if (!session?.user?.permissions?.can_change_config) redirect("/photos");

    const transcodeSettings = await getVidTranscodeSettings();
    const aiSettings = await getAiSettings();

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <Link href="/admin" className="text-foreground hover:underline text-sm font-bold mb-6 inline-black">
                &larr; Back to Dashboard
            </Link>
            <h1 className="text-2xl font-black text-foreground tracking-tight border-b border-border pb-4 mb-6">
                Process Config
            </h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                    <VideoTranscode currentSettings={transcodeSettings} />
                </div>
                <div>
                    <AiModelSettings currentSettings={aiSettings} mlApiUrl={process.env.ML_API_URL || ""} />
                </div>
            </div>
        </div>
    );
}