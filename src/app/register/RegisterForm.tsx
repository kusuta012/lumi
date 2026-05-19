"use client";
 
import { useActionState, useEffect } from "react";
import { publicRegisterAction } from "@/server/actions/register-actions";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterForm() {
    const router = useRouter();
    const [state, formAction, isPending] = useActionState(publicRegisterAction, null);

    useEffect(() => {
        if (state?.success) {
            alert("Account created successfully");
            router.push("/login");
        }
    }, [state, router]);

    return (
        <form action={formAction} className="space-y-5">
            <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">Username</label>
                <input name="username" type="text" required className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors" />
            </div>
            <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">Email</label>
                <input name="email" type="email" required className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors" />
            </div>
            <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">Password</label>
                <input name="password" type="password" required minLength={8} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors" />
            </div>
            <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">Confirm Password</label>
                <input name="confirmPassword" type="password" required minLength={8} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors" />
            </div>


            {state?.error && (
                <div className="text-red-400 text-sm bg-red-400/10 p-3 rounded-lg border border-red-400/20">
                    {state.error}
                </div>
            )}

            <button type="submit" disabled={isPending} className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-lg transition-colors mt-2 shadow-lg shadow-orange-900/20">
                {isPending ? "Creating.." : "Sign Up"}
            </button>
            <div className="mt-6 text-center text-sm text-neutral-500 font-medium">
                ALready have an account?{" "} 
                <Link href="/login" className="text-orange-500 hover:underline transition-all">Sign in</Link>
            </div>
        </form>
    );
}