"use client";

import { useState, useTransition } from "react";
import { updateFlippers } from "@/server/actions/config-actions";
import { useNotification } from "../providers/NotificationProvider";
import { useRouter } from "next/navigation";
import { FLIPPER_META } from "@/lib/flipper-constants";
import type { FlipperKey } from "@/lib/flipper-constants";

interface Props {
    currentState: Record<FlipperKey, boolean>;
}

export default function FeatureFlippers({ currentState }: Props) {
    const { notify } = useNotification();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [state, setState] = useState(currentState);

    const toggle = (key: FlipperKey) => {
        setState(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const hasChanges = JSON.stringify(state) !== JSON.stringify(currentState);
    const handleSave = () => {
        startTransition(async () => {
            const res = await updateFlippers(state);
            if (res.success) {
                notify("success", "Saved", "Feature flippers updated");
                router.refresh();
            } else {
                notify("error", "Error", res.error || "Failed to save flippers");
                setState(currentState);
            }
        });
    };

    return (
        <div className="space-y-4 mt-6">
            <h2 className="text-foreground font-bold border-b border-orange-600/30 pb-2">
                Feature Flippers
            </h2>
            <div className="border border-border bg-background p-4 space-y-3">
                <span className="text-muted uppercase text-[10px] font-bold block">Platform</span>
                {FLIPPER_META.map(f => (
                    <button key={f.key} onClick={() => toggle(f.key)} className={`w-full flex items-center justify-between p-3 border rounded-lg transition-colors ${state[f.key] ? 'border-green-600/30' : 'border-red-600/30'}`}>
                        <div className="text-left">
                            <span className={`text-sm font-bold block ${state[f.key] ? 'text-foreground' : 'text-red-400'}`}>{f.label}</span>
                            <span className="text-[10px] text-muted">{f.desc}</span>
                        </div>
                        <div className={`w-9 h-5 rounded-full transition-colors relative ${state[f.key] ? 'bg-green-600' : 'bg-red-600/40'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${state[f.key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </div>
                    </button>
                ))}
            </div>
            {hasChanges && (
                <button onClick={handleSave} disabled={isPending} className="w-full bg-orange-500 text-white font-bold py-2.5 rounded-lg hover:bg-orange-400 disabled:opacity-50 text-sm">
                    {isPending ? "Saving.." : "Save Flippers"}
                </button>
            )}
        </div>
    );
}