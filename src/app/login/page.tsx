"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/server/actions/auth-actions";
import Link from "next/link"

export default function LoginPage() {
    const [state, formAction, isPending] = useActionState<LoginState, FormData>(loginAction, null);

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-8 shadow-2xl">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-foreground mb-2">Lumi</h1>
                    <p className="text-muted text-sm">
                        {state?.mfaRequired ? "Two-Factor Verification" : "Sign in"}
                    </p>
                </div>
                
                <form action={formAction} className="space-y-5">
                    <div className={state?.mfaRequired ? "hidden" : "space-y-5" }>
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Username</label>
                            <input name="username" type="text" required={!state?.mfaRequired} className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"></input>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
                            <input name="password" type="password" required={!state?.mfaRequired} minLength={8} className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"></input>
                        </div>
                    </div>

                    {state?.mfaRequired && (
                        <div className="space-y-5 animate-in slide-in-from-right duration-300">
                            <div>
                                <label className="block text-sm font-medium text-muted mb-1.5 text-center">Enter your 2FA Code</label>
                                <input name="mfaToken" type="text" pattern="[0-9]*" inputMode="numeric" maxLength={6} required={!state?.mfaRequired} autoFocus placeholder="000000" className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-center text-xl tracking-widest text-foreground focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors" />
                            </div>
                        </div>
                    )}

                    {state?.error && (
                        <div className="text-red-400 text-sm bg-red-400/10 p-3 rounded-lg border border-red-400/20">
                            {state.error}
                        </div>
                    )}

                    <button type="submit" disabled={isPending} className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-foreground font-medium py-2.5 px-4 rounded-lg transition-colors mt-4">{isPending ? "Signing in...": "Sign in"}</button>
                </form>

                <div className="mt-6 text-center text-sm text-muted font-medium">
                    Don't Have an account?{" "}
                    <Link href="/register" className="text-orange-500 hover:underline transition-all">Sign Up</Link>
                </div>
            </div>
        </div>
    )
}