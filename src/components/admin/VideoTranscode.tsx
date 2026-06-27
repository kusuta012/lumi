"use client";

import { useTransition, useState } from "react";
import { updateVidTranscodeSettings } from "@/server/actions/config-actions";
import { Save, Loader2 } from "lucide-react";

export default function VideoTranscode({ currentSettings }: { currentSettings: any }) {
    const [isPending, startTransition] = useTransition();
    const [settings, setSettings] = useState(currentSettings);
    const [isSaved, setIsSaved] = useState(false);

    const handleSave = () => {
        startTransition(async () => {
            await updateVidTranscodeSettings(settings);
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2000);
        });
    };

    return (
        <div className="border border-border bg-surface p-4 mt-4">
            <h3 className="text-foreground font-bold text-sm border-b border-border pb-2 mb-4">HLS Video Transcoding</h3>
            <div className="space-y-4">
                <label className="flex items-center justify-between">
                    <div>
                        <span className="text-sm text-foreground block">Force HEVC / ProRes</span>
                        <span className="text-[10px] text-muted">Always transcode unsupported codecs</span>
                    </div>
                    <input type="checkbox" checked={settings.enableHevc} onChange={e => setSettings({...settings, enableHevc: e.target.checked})} className="accent-orange-500 w-4 h-4" />
                </label>
                <div className="flex items-center justify-between border-t border-border pt-3">
                    <div>
                        <span className="text-sm text-foreground block">Large Files</span>
                        <span className="text-[10px] text-muted">Transcode if file size exceeds threshold</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" checked={settings.enableLarge} onChange={e => setSettings({...settings, enableLarge: e.target.checked})} className="accent-orange-500 w-4 h-4" />
                        <div className="flex items-center border border-border px-2 py-1 bg-background">
                            <input type="number" min="1" disabled={!settings.enableLarge} value={settings.largeThresholdMB} onChange={e => setSettings({...settings, largeThresholdMB: Math.max(1, Number(e.target.value))})} className="bg-transparent w-12 text-sm text-center outline-none text-foreground" />
                            <span className="text-xs text-muted ml-1">MB</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                    <div>
                        <span className="text-sm text-foreground block">Long Videos</span>
                        <span className="text-[10px] text-muted">Transcode if duration exceeds threshold</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" checked={settings.enableLong} onChange={e => setSettings({...settings, enableLong: e.target.checked})} className="accent-orange-500 w-4 h-4" />
                        <div className="flex items-center border border-border px-2 py-1 bg-background">
                            <input type="number" min="1" disabled={!settings.enableLong} value={settings.longThresholdSec} onChange={e => setSettings({...settings, longThresholdSec: Math.max(1, Number(e.target.value))})} className="bg-transparent w-12 text-sm text-center outline-none text-foreground" />
                            <span className="text-xs text-muted ml-1">Sec</span>
                        </div>
                    </div>
                </div>
                <div className="pt-2 flex justify-end">
                    <button onClick={handleSave} disabled={isPending} className="flex items-center gap-2 bg-foreground px-4 py-2 text-xs font-bold hover:bg-orange-500 hover:text-white transition-colors disabled:opacity-50">
                        {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {isSaved ? "Saved!" : "Save Rules"}
                    </button>
                </div>
            </div>
        </div>
    );
}