"use client";

import { useState, useRef } from "react";
import { UploadCloud, Loader2, CheckCircle } from "lucide-react";
import { startGtakeoutImport } from "@/server/actions/takeout-actions";
import { useNotification } from "../providers/NotificationProvider";

export default function TakeoutImport() {
    const { notify } = useNotification();
    const [isUploading, setIsUploading] = useState(false);
    const [progess, setProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.endsWith(".zip")) {
            notify("error", "Invalid File", "Please upload a .zip file from Google Takeout");
            return;
        }
        const sizeInGB = file.size / (1024 * 1024 * 1024);
        if (sizeInGB > 5) {
            const confirmUpload = window.confirm(`This file is very large (${sizeInGB.toFixed(1)})GB. The upload may take a long time and your browser must stay open, Continue?`);
            if (!confirmUpload) return;
        }

        setIsUploading(true);
        setProgress(0);

        try {
            const res = await fetch("/api/upload/presigned", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    filename: file.name,
                    fileSize: file.size,
                    contentType: file.type || "application/zip",
                    intent: "takeout"
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || data.message || "Failed to get upload url");
            }

            const { presignedUrl, objectKey } = await res.json();
            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.upload.addEventListener("progress", (e) => {
                    if (e.lengthComputable) {
                        setProgress(Math.round((e.loaded / e.total) * 100));
                    }
                });
                xhr.addEventListener("load", () => {
                    if (xhr.status >= 200 && xhr.status < 300) resolve(null);
                    else reject(new Error("Upload failed"));
                });
                xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
                xhr.open("PUT", presignedUrl);
                xhr.setRequestHeader("Content-Type", file.type || "application/zip");
                xhr.send(file);
            });

            const importRes = await startGtakeoutImport(objectKey);
            if (importRes.success) {
                notify("success", "Import Started", importRes.message);
            } else {
                throw new Error(importRes.error || "Failed to start import");
            }
        } catch (err: any) {
            notify("error", "Import failed", err.message);
        } finally {
            setIsUploading(false);
            setProgress(0);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    return (
        <div className="border border-border rounded-xl p-5 bg-surface shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-sm font-bold text-foreground">Import from Google Photos</h3>
                </div>
                <div className="shrink-0 w-full sm:w-auto">
                    <input
                        type="file"
                        accept=".zip"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        disabled={isUploading}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-surface-hover border border-border hover:bg-border/50 rounded-lg text-sm font-medium text-foreground transition-colors disabled:opacity-50">
                        {isUploading ? (
                            <>
                                <Loader2 size={16} className="animate-spin text-orange-500" />
                                {progess < 100 ? `Uploading ${progess}%` : "Processing..."}
                            </>
                        ) : (
                            <>
                                <UploadCloud size={16} className="text-orange-500" />
                                Select .zip file
                            </>
                        )}
                    </button>
                </div>
            </div>
            
            {isUploading && (
                <div className="mt-4 h-1.5 w-full bg-surface-hover overflow-hidden rounded-full border border-border">
                    <div className="h-full bg-orange-500 transition-all duration-300 ease-out" style={{ width: `${progess}%` }} />
                </div>
            )}
        </div>
    );
}