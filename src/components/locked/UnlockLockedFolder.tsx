"use client";

import { useState, useRef, useTransition, useEffect } from "react"; 
import { unlockWithPin, setLockedFolderPin } from "@/server/actions/locked-actions";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

export default function UnlockLockedFolder({ needsSetup }: { needsSetup: boolean }) {
    const router = useRouter();
    const [ isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
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
            setError(null);
            startTransition(async () => {
                const res = needsSetup ? await setLockedFolderPin(fullPin) : await unlockWithPin(fullPin);
                if (res.success) {
                    router.refresh();
                } else {
                    setError(res.error || "Failed");
                    setPin(Array(6).fill(""));
                    inputsRef.current[0]?.focus();
                }
            });
        }
    }, [pin, needsSetup, router]);

    return (
        <div className="w-full max-w-sm bg-[#121212]/90 border border-neutral-800 rounded-2xl p-8 text-center space-y-6 z-10 relative">
            <div className="w-12 h-12 border border-orange-500/20 text-orange-500 rounded-lg flex items-center justify-center mx-auto">
                <Lock size={22} /> 
            </div>
            <div>
                <h2 className="text-white font-bold text-sm tracking-wide">
                    {needsSetup ? "Set Locked Folder PIN" : "Enter PIN Code:"}
                </h2>
                <p className="text-neutral-500 text-xs mt-2">
                    {needsSetup ? "Create a 6-digit PIN to secure your locked folder" : "Enter your pin code to access the locked folder"}
                </p>
            </div>
            <div className="flex gap-2 justify-center py-2">
                {pin.map((digit, idx) => (
                    <input key={idx} ref={(el) => { inputsRef.current[idx] = el; }} type="password" pattern="[0-9]*" inputMode="numeric" maxLength={1} value={digit} onChange={(e) => handleChange(e.target.value, idx)} onKeyDown={(e) => handleKeyDown(e, idx)} disabled={isPending} className="w-11 h-11 bg-[#1a1a1a] border border-neutral-800 rounded-xl text-center text-lg font-bold text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all" />
                ))}
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button type="button" onClick={() => router.push("/photos")} className="px-6 py-2 bg-neutral-800 text-white rounded-lg text-xs font-bold transition-colors hover:bg-neutral-700">Cancel</button>
        </div>
    );
}