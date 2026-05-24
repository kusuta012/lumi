"use client";

import { useActionState } from "react";
import { completeSetupAction } from "@/server/actions/setup";

export default function SetupPage() {
    const [state, formAction, isPending] = useActionState(completeSetupAction, null);

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-8 shadow-2xl">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-foreground mb-2">Lumi</h1>
                    <p className="text-muted text-sm">Create Super Admin Account</p>
                </div>

                <form action={formAction} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Username</label>
                        <input name="username" type="text" required className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"></input>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                        <input name="email" type="email" required minLength={8} className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"></input>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
                        <input name="password" type="password" required minLength={8} className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"></input>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Confirm Password</label>
                        <input name="confirmPassword" type="password" required minLength={8} className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"></input>
                    </div>

                    {state?.error && (
                        <div className="text-red-400 text-sm bg-red-400/10 p-3 rounded-lg border border-red-400/20">
                            {state.error}
                        </div>
                    )}

                    <button type="submit" disabled={isPending} className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-foreground font-medium py-2.5 px-4 rounded-lg transition-colors mt-4">{isPending ? "Setting up...": "Complete Setup"}</button>
                </form>
            </div>
        </div>
    );
}