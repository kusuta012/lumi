import { getRegistrationSetting } from "@/server/actions/config-actions";
import Link from "next/link";
import RegisterForm from "./RegisterForm";
import { isFlipperEnabled } from "@/lib/flippers";

export default async function RegisterPage() {
    const isRegistrationOpen = await isFlipperEnabled("registration_enabled");

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-8 shadow-2xl">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-foreground mb-2">Lumi</h1>
                    <p className="text-muted text-sm">Create an account</p>
                </div>

                {!isRegistrationOpen ? (
                    <div className="text-center space-y-6">
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm">
                            Registration is currently invite only. Please contact the admin for an account
                        </div>
                        <Link href="/login" className="block w-full bg-surface-hover hover:bg-surface-hover text-foreground font-medium py-2.5 rounded-lg transition-colors">
                            Return to Login
                        </Link>
                    </div>
                ) : (
                    <RegisterForm />
                )}
            </div>
        </div>
    );
}

