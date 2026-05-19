import { getRegistrationSetting } from "@/server/actions/config-actions";
import Link from "next/link";
import RegisterForm from "./RegisterForm";

export default async function RegisterPage() {
    const isRegistrationOpen = await getRegistrationSetting();

    return (
        <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl p-8 shadow-2xl">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-neutral-100 mb-2">Lumi</h1>
                    <p className="text-neutral-400 text-sm">Create an account</p>
                </div>

                {!isRegistrationOpen ? (
                    <div className="text-center space-y-6">
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm">
                            Registration is currently invite only. Please contact the admin for an account
                        </div>
                        <Link href="/login" className="block w-full bg-neutral-800 hover:bg-neutral-700 text-white font-medium py-2.5 rounded-lg transition-colors">
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

