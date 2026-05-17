"use client";

import { useState } from "react";
import { recordMediaUpload } from "@/server/actions/media";
import { UploadCloud } from "lucide-react";

export default function UploadButton() {
    const [loading, setLoading] = useState(false);
    const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            const res = await fetch("/api/upload/presigned", {
                method: "POST",
                headers: { "Content-Type": "applications/json" },
                body: JSON.stringify({ filename: file.name, contentType: file.type }),
            });
            const { presignedUrl, objectKey } = await res.json();

            await fetch(presignedUrl, {
                method: "PUT",
                body: file,
                headers: { "Content-Type": file.type },
            });

            await recordMediaUpload({
                filename: file.name,
                mimetype: file.type,
                size: file.size,
                objectKey: objectKey,
            });

            alert("Upload complete");
        } catch (err) {
            console.error(err);
            alert("Upload failed");
        } finally {
            setLoading(false);
            e.target.value = "";
        }
    };

    return (
        <label className="flex items-center gap-2 px-4 py-1.5 bg-transparent hover:bg-neutral-800 border-neutral-700 text-neutral-300 rounded-full cursor-pointer transition-all text-sm disabled:opacity-50">
            <UploadCloud className="w-4 h-4"></UploadCloud>
            {loading ? "Uploading.." : "Upload"}
            <input type="file" className="hidden" onChange={onFileSelect} disabled={loading} />
        </label>
    );
}