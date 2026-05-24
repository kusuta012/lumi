"use client";

import { useTransition } from "react";
import { manageQueue } from "@/server/actions/worker-actions";
import { useNotification } from "../providers/NotificationProvider";
import { Play, Pause, RefreshCw, Trash2} from "lucide-react";

interface QueueProps {
    queue: {
        name: string;
        displayName: string;
        description: string;
        isPaused: boolean;
        counts: {
            active: number;
            completed: number;
            failed: number;
            delayed: number;
            waiting: number;
            paused: number;
        };
    };
}

export default function QueueCard({ queue }: QueueProps) {
    const { notify } = useNotification();
    const [isPending, startTransition] = useTransition();

    const handleAction = (action: 'retry' | 'clean' | 'toggle-pause') => {
        const execute = () => {
            startTransition(async () => {
                const res = await manageQueue(queue.name, action);
                if(res.success) {
                    notify("success", "Queue Updated", `Action executed succesfully on  ${queue.displayName}`);
                } else {
                    notify("error", "Action Failed", res.error); // HELLO, CAN I CHEESE YOU?
                }
            });
        };

        if (action === 'clean') {
            if (confirm(`Are you sure you want to wipe the job hisorty for ${queue.displayName}?`)) {
                execute();
            }
        } else if (action === 'retry') {
            if (confirm(`Re add all failed jobs back to active queue for ${queue.displayName}`)) {
                execute();
            }
        } else {
            execute();
        }
    };

    return (
        <div className="border border-border bg-surface rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex justify-between items-start border-b border-border pb-4">
                <div>
                    <h3 className="text-foreground font-bold text-lg tracking-tight">{queue.displayName}</h3>
                    <p className="text-xs text-muted mt-1">{queue.description}</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-muted">
                        {queue.isPaused ? "Paused" : "Active"}
                    </span>
                    <div className={`w-2.5 h-2.5 rounded-full ${queue.isPaused ? 'bg-yellow-500 animate-pulse' : 'bg-emerald-500'}`} />
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <MetricBox label="Waiting" value={(queue.counts?.waiting ?? 0) + (queue.counts?.paused ?? 0)} color="text-blue-500" />
                <MetricBox label="Active" value={queue.counts.active} color="text-orange-500" />
                <MetricBox label="Completed" value={queue.counts.completed} color="text-emerald-500" />
                <MetricBox label="Failed" value={queue.counts.failed} color="text-red-500" />
                <MetricBox label="Delayed" value={queue.counts.delayed} color="text-yellow-500" />
            </div>
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                <button onClick={() => handleAction('toggle-pause')} disabled={isPending} className="flex items-center gap-2 px-3 py-1.5 border border-border hover:border-orange-500 bg-surface-hover text-xs font-bold text-foreground hover:text-foreground transition-colors disabled:opacity-50">
                    {queue.isPaused ? <Play size={12} /> : <Pause size={12} />}
                    {queue.isPaused ? "Resume Queue" : "Pause Queue"}
                </button>
                <button onClick={() => handleAction('retry')} disabled={isPending || queue.counts.failed === 0} className="flex items-center gap-2 px-3 py-1.5 border border-border hover:border-emerald-500 bg-surface-hover text-xs font-bold text-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:hover:border-border">
                    <RefreshCw size={12} /> Retry Failed
                </button>
                <button onClick={() => handleAction('clean')} disabled={isPending} className="flex items-center gap-2 px-3 py-1.5 border border-border hover:border-red-500 bg-surface-hover text-xs font-bold text-foreground hover:text-red-500 transition-colors disabled:opacity-50">
                    <Trash2 size={12} /> Clear History
                </button>
            </div>
        </div>
    );
}

function MetricBox({ label, value, color }: { label: string, value: number, color: string }) {
    return (
        <div className="border border-border bg-background p-3 rounded-xl">
            <span className="text-[12px] text-muted block mb-1 tracking-wider">
                {label}
            </span>
            <span className={`text-[18px] font-bold tracking-tight ${value > 0 ? color : 'text-muted'}`}>
                {value}
            </span>
        </div>
    );
}