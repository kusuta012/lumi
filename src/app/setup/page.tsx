"use client";

import { useActionState } from "react";
import { completeSetupAction } from "@/server/actions/setup";

export default function SetupPage() {
    const [state, formAction, isPending] = useActionState(completeSetupAction, null);

    return (
        <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-8 shadow-2xl">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-neutral-100 mb-2">Lumi</h1>
                    <p className="text-neutral-400 text-sm">Create Super Admin Account</p>
                </div>

                <form action={formAction} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-neutral-300 mb-1.5">Username</label>
                        <input name="username" type="text" required className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-neutral-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"></input>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-300 mb-1.5">Email</label>
                        <input name="email" type="email" required minLength={8} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-neutral-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"></input>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-neutral-300 mb-1.5">Password</label>
                        <input name="password" type="password" required minLength={8} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-neutral-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"></input>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-neutral-300 mb-1.5">Confirm Password</label>
                        <input name="confirmPassword" type="password" required minLength={8} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-neutral-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"></input>
                    </div>

                    {state?.error && (
                        <div className="text-red-400 text-sm bg-red-400/10 p-3 rounded-lg border border-red-400/20">
                            {state.error}
                        </div>
                    )}

                    <button type="submit" disabled={isPending} className="w-full bg-orange-600 hover:bg-white-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-lg transition-colors mt-4">{isPending ? "Setting up...": "Complete Setup"}</button>
                </form>
            </div>
        </div>
    );
}