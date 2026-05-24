"use client";

import { useState, useRef, useTransition, useEffect } from "react"; 
import { unlockWithPin, setLockedFolderPin } from "@/server/actions/locked-actions";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { useNotification } from "../providers/NotificationProvider";

export default function UnlockLockedFolder({ needsSetup }: { needsSetup: boolean }) {
    const router = useRouter();
    const [ isPending, startTransition] = useTransition();
    const { notify } = useNotification();
    const [pin, setPin] = useState<string[]>(Array(6).fill(""));
    const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
    const handleChange = (val: string, index: number) => {
        if (isNaN(Number(val))) return;
        const newPin = [...pin];
        newPin[index] = val.slice(-1);
        setPin(newPin);

        if (val && index < 5) {
            inputsRef.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === "Backspace" && !pin[index] && index > 0) {
            inputsRef.current[index - 1]?.focus();
        }
    };

    useEffect(() => {
        const fullPin = pin.join("");
        if (fullPin.length === 6) {
            startTransition(async () => {
                const res = needsSetup ? await setLockedFolderPin(fullPin) : await unlockWithPin(fullPin);
                if (res.success) {
                    notify("success", "Unlocked", "Secure Folder Unlocked");
                    router.refresh();
                } else {
                    notify("error", "Access Denied", res.error || "Incorrect PIN");
                    setPin(Array(6).fill(""));
                    inputsRef.current[0]?.focus();
                }
            });
        }
    }, [pin, needsSetup, router, notify]);

    return (
        <div className="w-full max-w-sm bg-surface/90 border border-border rounded-2xl p-8 text-center space-y-6 z-10 relative">
            <div className="w-12 h-12 border border-orange-500/20 text-orange-500 rounded-lg flex items-center justify-center mx-auto">
                <Lock size={22} /> 
            </div>
            <div>
                <h2 className="text-foreground font-bold text-sm tracking-wide">
                    {needsSetup ? "Set Locked Folder PIN" : "Enter PIN Code:"}
                </h2>
                <p className="text-muted text-xs mt-2">
                    {needsSetup ? "Create a 6-digit PIN to secure your locked folder" : "Enter your pin code to access the locked folder"}
                </p>
            </div>
            <div className="flex gap-2 justify-center py-2">
                {pin.map((digit, idx) => (
                    <input key={idx} ref={(el) => { inputsRef.current[idx] = el; }} type="password" pattern="[0-9]*" inputMode="numeric" maxLength={1} value={digit} onChange={(e) => handleChange(e.target.value, idx)} onKeyDown={(e) => handleKeyDown(e, idx)} disabled={isPending} className="w-11 h-11 bg-surface border border-border rounded-xl text-center text-lg font-bold text-foreground focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all" />
                ))}
            </div>  
            <button type="button" onClick={() => router.push("/photos")} className="px-6 py-2 bg-surface-hover text-foreground rounded-lg text-xs font-bold transition-colors hover:bg-surface-hover">Cancel</button>
        </div>
    );
}