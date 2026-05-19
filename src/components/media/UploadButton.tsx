"use client";

import { useState } from "react";
import { recordMediaUpload } from "@/server/actions/media";
import { UploadCloud } from "lucide-react";
import { error } from "node:console";

export default function UploadButton() {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState("");
    const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length ===0 ) return;

        setLoading(true);
        const totalFiles = files.length;
        try {
            for (let i = 0; i < totalFiles; i++) {
                const file = files[i];
                setProgress(`Uploading ${i + 1}/${totalFiles}....`);

                const res = await fetch("/api/upload/presigned", {
                    method: "POST",
                    headers: { "Content-Type": "applications/json" },
                    body: JSON.stringify({ filename: file.name, contentType: file.type, fileSize: file.size }),
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.message || `Failed to get upload URL for ${file.name}`);
                }

                const { presignedUrl, objectKey } = await res.json();
                const uploadRes = await fetch(presignedUrl, {
                    method: "PUT",
                    body: file,
                    headers: { "Content-Type": file.type },
                });

                if (!uploadRes.ok) {
                    throw new Error(`failed to upload ${file.name} to nucket`);
                }

                await recordMediaUpload({
                    filename: file.name,
                    mimetype: file.type,
                    size: file.size,
                    objectKey: objectKey,
                });
            }

            alert("Upload complete");
        } catch (err: any) {
            console.error("batch upload failed", err);
            alert(`Upload failed ${err.message || "unknown erorr"}`);
        } finally {
            setLoading(false);
            setProgress("");
            if (e.target) e.target.value = "";
        }
    };

            

    return (
        <label className="flex items-center gap-2 px-4 py-1.5 bg-transparent hover:bg-neutral-800 border-neutral-700 text-neutral-300 rounded-full cursor-pointer transition-all text-sm font-medium disabled:opacity-50">
            <UploadCloud className="w-4 h-4"></UploadCloud>
            {loading ? progress : "Upload"}
            <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={onFileSelect} disabled={loading} />
        </label>
    );
}