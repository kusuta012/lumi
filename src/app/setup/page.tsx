"use client";

import { useActionState, useState, useTransition } from "react";
import { completeSetupAction, testStorageConnection } from "@/server/actions/setup";


const STEP = 3;
export default function SetupPage() {
    const [step, setStep] = useState(0);
    const [state, formAction, isPending] = useActionState(completeSetupAction, null);
    const [form, setForm] = useState({
        username: "", email: "", password: "", confirmPassword: "",
        storageType: "env",
        s3Endpoint: "", s3Port: "9000", s3AccessKey: "", s3SecretKey: "",
        s3Bucket: "lumi", s3Ssl: false,
    });

    const [testPending, startTest] = useTransition();
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const set = (key: string, val: string | boolean) => {
        setForm(prev => ({ ...prev, [key]: val }));
        if (key === "storageType") setTestResult(null);
    };

    const step0valid = form.username.length >=3 && form.email.includes("@")
        && form.password.length >=8 && form.password === form.confirmPassword;
    
    const step1valid = form.storageType === "env"
        || (form.s3Endpoint.length > 0 && form.s3AccessKey.length > 0 && form.s3SecretKey.length > 0);
    
    const canAdvance = step === 0 ? step0valid : step === 1 ? step1valid : true;

    const handleTest = () => {
        startTest(async () => {
            const res = await testStorageConnection({
                endpoint: form.s3Endpoint,
                port: form.s3Port,
                accessKey: form.s3AccessKey,
                secretKey: form.s3SecretKey,
                bucket: form.s3Bucket,
                useSsl: form.s3Ssl
            });
            setTestResult(res);
        });
    };

    const inputClass = "w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted/50 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors text-sm";
    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md">
                <form action={formAction}>
                    {Object.entries(form).map(([k, v]) => (
                        <input key={k} type="hidden" name={k} value={String(v)} />
                    ))}
                    <div className="bg-surface border border-border rounded-2xl p-8">
                        <div className="flex items-center justify-center gap-3 mb-6">
                            <img src="/favicon.ico" alt="lumi" className="w-9 h-9 rounded" />
                            <span className="text-xl font-bold tracking-tight text-foreground">Lumi</span>
                        </div>
                        <div className="flex items-center justify-center gap-2 mb-8"> 
                            {/* I switched to a new mechanical keyboard */}
                            {Array.from({ length: 3 }).map((_, i) =>(
                                <div
                                    key={i}
                                    className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                                        i === step ? "bg-orange-500" :
                                        i < step ? "bg-orange-500/40" : "bg-border"
                                    }`}
                                />
                            ))} 
                        </div>
                        {step === 0 && (
                            <div className="space-y-5">
                                <div className="text-center mb-6">
                                    <h1 className="text-2xl font-bold text-foreground">Welcome to Lumi</h1>
                                    <p className="text-muted text-sm mt-1">Create your admin account to get started</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1.5">Username</label>
                                    <input type="text" value={form.username} onChange={e => set("username", e.target.value)} placeholder="admin" className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                                    <input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="admin@example.com" className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
                                    <input type="password" value={form.password} onChange={e => set("password", e.target.value)} placeholder="Minimum 8 characters" className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1.5">Confirm Password</label>
                                    <input type="password" value={form.confirmPassword} onChange={e => set("confirmPassword", e.target.value)} placeholder="Re-enter your password" className={inputClass} />
                                    {form.password.length > 0 && form.confirmPassword.length > 0 && form.password !== form.confirmPassword && (
                                        <p className="text-red-400 text-xs mt-1.5">Passwords do not match</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {step === 1 && (
                            <div className="space-y-5">
                                <div className="text-center mb-6">
                                    <h1 className="text-2xl font-bold text-foreground">Storage</h1>
                                    <p className="text-muted text-sm mt-1">Where should Lumi store your media?</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <button type="button" onClick={() => set("storageType", "env")} className={`p-4 border rounded-xl text-left transition-colors ${
                                        form.storageType === "env"
                                            ? "border-orange-500 bg-orange-500/5"
                                            : "border-border hover:border-border/80"
                                    }`}>
                                        <span className={`text-sm font-bold block ${form.storageType === "env" ? "text-orange-500" : "text-foreground"}`}>
                                            Environment
                                        </span>
                                        <span className="text-[11px] text-muted mt-0.5 block">Use .env defaults</span>
                                    </button>
                                    <button type="button" onClick={() => set("storageType", "custom")}
                                        className={`p-4 border rounded-xl text-left transition-colors ${
                                            form.storageType === "custom"
                                                ? "border-orange-500 bg-orange-500/5"
                                                : "border-border hover:border-border/80"
                                        }`}>
                                            <span className={`text-sm font-bold block ${form.storageType === "custom" ? "text-orange-500" : "text-foreground"}`}>
                                                Custom S3
                                            </span>
                                            <span className="text-[11px] text-muted mt-0.5 block">MinIO or S3-compatible</span>
                                        </button>
                                </div>
                                {form.storageType === "env" && (
                                    <div className="bg-green-500/5 border border-green-500/20 text-green-400 p-3 rounded-lg text-xs">
                                        Lumi will use the MINIO_* variables from your .env file
                                    </div>
                                )}

                                {/* I'm procrastinating a lot :( */}
                                {form.storageType === "custom" && (
                                    <div className="space-y-3 pt-1">
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="col-span-2">
                                                <label className="block text-xs font-medium text-foreground mb-1">Endpoint</label>
                                                <input type="text" placeholder="minio.example.com" value={form.s3Endpoint} onChange={e => set("s3Endpoint", e.target.value)} className={inputClass} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-foreground mb-1">Port</label>
                                                <input type="text" value={form.s3Port} onChange={e => set("s3Port", e.target.value)} className={inputClass} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-foreground mb-1">Access Key</label>
                                            <input type="text" value={form.s3AccessKey} onChange={e => set("s3AccessKey", e.target.value)} className={inputClass} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-foreground mb-1">Secret Key</label>
                                            <input type="password" value={form.s3SecretKey} onChange={e => set("s3SecretKey", e.target.value)} className={inputClass} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-foreground mb-1">Bucket</label>
                                                <input type="text" value={form.s3Bucket} onChange={e => set("s3Bucket", e.target.value)} className={inputClass} />
                                            </div>
                                            <div className="flex items-end pb-2.5">
                                                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
                                                    <input type="checkbox" checked={form.s3Ssl} onChange={e => set("s3Ssl", e.target.checked)} className="accent-orange-500 w-3.5 h-3.5" />
                                                    Use SSL
                                                </label>
                                            </div>
                                        </div>
                                        <button type="button" onClick={handleTest} disabled={testPending || !form.s3Endpoint || !form.s3AccessKey || !form.s3SecretKey} className="w-full border border-orange-500/50 text-orange-500 hover:bg-orange-500/10 disabled:opacity-40 disabled:hover:bg-transparent font-medium py-2 rounded-lg transition-colors text-xs">
                                            {testPending ? "Testing..." : "Test connection"}
                                        </button>

                                        {testResult && (
                                            <div className={`p-2.5 rounded-lg text-xs border ${
                                                testResult.success ? "bg-green-500/5 border-green-500/20 text-green-400" : "bg-red-400/5 border-red-400/20 text-red-400"
                                            }`}>
                                                {testResult.message}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-5">
                                <div className="text-center mb-6">
                                    <h1 className="text-2xl font-bold text-foreground">You are all set!</h1>
                                    <p className="text-muted text-sm mt-1">Review your setup before proceeding</p>
                                </div>
                                <div className="border border-border rounded-xl divide-y divide-border">
                                    <div className="flex justify-between items-center px-4 py-3">
                                        <span className="text-sm text-muted">Admin</span>
                                        <span className="text-sm text-foreground font-mono">{form.username}</span>
                                    </div>
                                    <div className="flex justify-between items-center px-4 py-3">
                                        <span className="text-sm text-muted">Email</span>
                                        <span className="text-sm text-foreground truncate ml-4-max-w-[200px]">{form.email}</span>
                                    </div>
                                    <div className="flex justify-between items-center px-4 py-3">
                                        <span className="text-sm text-muted">Storage</span>
                                        <span className="text-sm text-foreground">
                                            {form.storageType === "env" ? "ENV Defaults" : form.s3Endpoint + ":" + form.s3Port}
                                        </span>
                                    </div>
                                </div>
                                <p className="text-muted text-[11px] text-center">
                                    Everything can be changed later from the admin dashboard
                                </p>
                            </div>
                        )}
                        {state?.error && (
                            <div className="text-red-400 text-sm bg-red-400/10 p-3 rounded-lg border border-red-400/20 mt-5">
                                {state.error}
                            </div>
                        )}
                        <div className="flex gap-3 mt-8">
                            {step > 0 && (
                                <button type="button" onClick={() => setStep(s => s - 1)} className="px-5 py-2.5 text-sm font-medium text-muted hover:text-foreground transition-colors">
                                    Back
                                </button>
                            )}
                            <div className="flex-1">
                                {step < 3 - 1 ? (
                                    <button type="button" onClick={() => setStep(s => s + 1)} disabled={!canAdvance} className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:hover:bg-orange-600 text-white font-medium py-2.5 rounded-lg transition-colors text-sm">
                                        Continue
                                    </button>
                                ) : (
                                    <button type="submit" disabled={isPending} className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm">
                                        {isPending ? "Setting up..." : "Launch Lumi"}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </form>
                <p className="text-center text-muted text-[10px] mt-6 tracking-wide">
                    Self-hosted media platform!a
                </p>
            </div>
        </div>
    );
}