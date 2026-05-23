"use client";

import { useState } from "react";
import { UploadCloud } from "lucide-react";
import { publicUploadToSharedAlbum } from "@/server/actions/share-actions";
import { useNotification } from "../providers/NotificationProvider";

export default function PublicUploadButton({ token }: { token: string }) {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState("");
    const { notify } = useNotification();

    const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setLoading(true);
        const totalFiles = files.length;

        try {
            for (let i = 0; i < totalFiles; i++) {
                const file = files[i];
                if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
                    console.warn(`file ${file.name} is not a valid media item`)
                    continue;
                }
                setProgress(`Uploading ${i + 1}/${totalFiles}...`);
                const res = await fetch(`/api/shared/${token}/upload/presigned`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ filename: file.name, contentType: file.type, fileSize: file.size }),
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || "Upload rejected");
                }
                const { presignedUrl, objectKey } = await res.json();
                const uploadRes = await fetch(presignedUrl, {
                    method: "PUT",
                    body: file,
                    headers: { "Content-Type": file.type },
                });
                if (!uploadRes.ok) throw new Error("Upload failed");

                await publicUploadToSharedAlbum(token, {
                    filename: file.name,
                    mimetype: file.type,
                    size: file.size,
                    objectKey,
                });
            }
            window.location.reload();
        } catch (err: any) {
            notify("error", "Error", "failed to upload file");
        } finally {
            setLoading(false);
            setProgress("");
        }
    };

    return (
        <label className="flex items-center gap-2 px-4 py-2 bg-transparent hover:bg-neutral-900 border border-neutral-800 text-neutral-300 rounded-lg cursor-pointer transition-colors text-xs font-bold tracking-wider">
            <UploadCloud className="w-4 h-4 text-orange-500" />
            {loading ? progress : "Upload"}
            <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={onFileSelect} disabled={loading} />
        </label>
    );
}