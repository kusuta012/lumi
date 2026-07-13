"use client";

import { useState, useTransition, useEffect } from "react";
import { Cpu, Zap} from "lucide-react";
import { updateAiSetting } from "@/server/actions/config-actions";
import { useNotification } from "../providers/NotificationProvider";
import { useRouter } from "next/navigation";

interface AiSettingsProps {
    currentSettings: any;
    mlApiUrl: string;
}

export default function AiModelSettings({ currentSettings, mlApiUrl }: AiSettingsProps) {
    const { notify } = useNotification();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [settings, setSettings] = useState(currentSettings);
    const [mlInfo, setMlInfo] = useState<any>(null);
    const [mlStatus, setMlStatus] = useState<"loading" | "online" | "offline">("loading");

    useEffect(() => {
        if (!mlApiUrl) { setMlStatus("offline"); return; }
        fetch(`${mlApiUrl}/info`)
            .then(res => res.json())
            .then(data => { setMlInfo(data); setMlStatus("online"); })
            .catch(() => setMlStatus("offline"));
    }, [mlApiUrl]);

    const toggle = (key: string) => {
        setSettings((prev: any) => ({ ...prev, [key]: !prev[key] }));
    };

    const setThreshold = (key: string, value: number) => {
        setSettings((prev: any) => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        startTransition(async () => {
            const res = await updateAiSetting(settings);
            if (res.success) {
                notify("success", "Saved", "Ai settings updated. Changes apply to new uploads");
                router.refresh();
            } else {
                notify("error", "Error", "Failed to save AI settings");
            }
        });
    };

    const hasChanges = JSON.stringify(settings) !== JSON.stringify(currentSettings);

    const features = [
        { key: "clip_enabled", label: "CLIP Search", desc: "Image search via text queries" },
        { key: "face_detection_enabled", label: "Face Detection", desc: "Detect and cluster faces" },
        { key: "ocr_enabled", label: "Text Extraction (OCR)", desc: "Extract text from images" },
        { key: "aesthetic_scoring_enabled", label: "Aesthetic Scoring", desc: "Rate image quality (used for highlights)" },
        { key: "auto_tagging_enabled", label: "Auto Tagging", desc: "Classify images via ViT" },
    ];

    return (
        <div className="space-y-6 mt-6">
            <h2 className="text-foreground font-bold border-b border-orange-600/30 pb-2">
                AI Processing
            </h2>
            <div className="border border-border bg-background p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">ML Service</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 ${
                        mlStatus === "online" ? "text-green-500" :
                        mlStatus === "offline" ? "text-red-500" :
                        "border-border text-muted"
                    }`}>
                        {mlStatus}
                    </span>
                </div>
                {mlInfo && (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="flex items-center gap-2">
                            {mlInfo.device === "cuda" ? <Zap size={12} className="text-green-500" /> : <Cpu size={12} className="text-muted" /> }
                            <span className="text-muted">
                                {mlInfo.device === "cuda" ? `${mlInfo.gpu_name} (${mlInfo.vram_gb} GB)` : `CPU (${mlInfo.ram_gb} GB RAM)`}
                            </span>
                        </div>
                        <div className="text-muted">
                            CLIP: <span className="text-foreground font-mono">{mlInfo.models?.clip?.split("/").pop()}</span>
                            {" "}({mlInfo.clip_embedding_dim}d)
                        </div>
                        <div className="text-muted">
                            OCR: <span>{mlInfo.models?.ocr ? "loaded" : "skipped"}</span>
                            {" | "}NIMA: <span>{mlInfo.models?.nima ? "loaded" : "skipped"}</span>
                        </div>
                    </div>
                )}
                {mlStatus === "offline" && (
                    <p className="text-xs text-red-400 mt-2">ML service is not reachable. Pls check if the container is running</p>
                )}
            </div>
            <div className="border border-border bg-background p-4 space-y-3">
                <span className="text-muted uppercase text-[10px] font-bold block">Feature Toggles</span>
                {features.map(f => (
                    <button key={f.key} onClick={() => toggle(f.key)} className={`w-full flex items-center justify-between p-3 border rounded-lg transition-colors ${settings[f.key] ? 'border-green-600/30' : 'border-border'}`}>
                        <div className="flex items-center gap-3">
                            <div className="text-left">
                                <span className={`text-sm font-bold block ${settings[f.key] ? 'text-foreground' : 'text-muted'}`}>{f.label}</span>
                                <span className="text-[10px] text-muted">{f.desc}</span>
                            </div>
                        </div>
                        <div className={`w-9 h-5 rounded-full transition-colors relative ${settings[f.key] ? 'bg-green-600' : 'bg-surface-hover'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings[f.key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </div>
                    </button>
                ))}
            </div>
            <div className="border border-border bg-background p-4 space-y-4">
                <span className="text-muted uppercase text-[10px] font-bold block">Threshold</span>
                <div>
                    <div className="flex justify-between text-xs mb-1">
                        <span className="text-foreground font-bold">Face Confidence</span>
                        <span className="text-orane-500 font-mono">{settings.face_confidence_threshold}</span>
                    </div>
                    <input type="range" min="0.50" max="0.99" step="0.01"
                        value={settings.face_confidence_threshold}
                        onChange={e => setThreshold("face_confidence_threshold", parseFloat(e.target.value))}
                        className="w-full accent-orange-500"
                    />
                    <p className="text-[10px] text-muted mt-1">Higher = fewer false positives, lower = more faces detected</p>
                </div>
                <div>
                    <div className="flex justify-between text-xs mb-1">
                        <span className="text-foreground font-bold">Face Clustering Distance</span>
                        <span>{settings.face_distance_threshold}</span>
                    </div>
                    <input type="range" min="0.20" max="0.60" step="0.01"
                        value={settings.face_distance_threshold}
                        onChange={e => setThreshold("face_distance_threshold", parseFloat(e.target.value))}
                        className="w-full accent-orange-500" 
                    />
                    <p className="text-[10px] text-muted mt-1">Lower = stricter matching, higher = more aggressive merging</p>
                </div>
            </div>
            {hasChanges && (
                <button onClick={handleSave} disabled={isPending}
                    className="w-full bg-orange-500 text-white font-bold py-2.5 rounded-lg hover:bg-irange-400 disabled:opacity-50 text-sm">
                    {isPending ? "Saving..." : "Save AI Settings"}
                </button>
            )}
        </div>
    );
}