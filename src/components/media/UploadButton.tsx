"use client";

import { useState } from "react";
import { recordMediaUpload } from "@/server/actions/media";
import { UploadCloud } from "lucide-react";
import { useNotification } from "../providers/NotificationProvider";
import { initMultipartUpload, getMultipartPreSignedUrls, completeMultipartUpload, abortMultipartUpload } from "@/server/actions/multipart";
async function calculateFileHash(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const CHUNK_SIZE = 10 * 1024 * 1024;
const MULTIPART_THRESHOLD = 20 * 1024 * 1024;

export default function UploadButton() {
    const { notify } = useNotification();
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState("");
    const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length ===0 ) return;

        const totalFiles = files.length;
        setLoading(true);
        try {
            let successCount = 0;
            let skippedCount = 0;
            let duplicatedCount = 0;
            for (let i = 0; i < totalFiles; i++) {
                const file = files[i];
                if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
                    console.warn(`file ${file.name} is not a valid media item`)
                    continue;
                }
                const pathParts = file.webkitRelativePath ? file.webkitRelativePath.split('/') : [];
                const albumName = pathParts.length > 1 ? pathParts[0] : undefined;

                setProgress(`Uploading ${i + 1}/${totalFiles}....`);
                const fileHash = await calculateFileHash(file);
                const res = await fetch("/api/upload/presigned", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ filename: file.name, contentType: file.type, fileSize: file.size, fileHash }),
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.message || `Failed to get upload URL for ${file.name}`);
                }

                const { presignedUrl, objectKey, backendId, isDuplicate } = await res.json();
                
                if (isDuplicate) {
                    successCount++;
                    duplicatedCount++;
                    continue;
                }
                if (file.size > MULTIPART_THRESHOLD) {
                    setProgress(`Uploading: ${file.name}...`);
                    const initRes = await initMultipartUpload(file.name, file.type);
                    if (!initRes.success || !initRes.uploadId) throw new Error("Multipart init failed");

                    const { uploadId, objectKey: multiKey, backendId: multiBackendId } = initRes;
                    const totalParts = Math.ceil(file.size / CHUNK_SIZE);
                    const uploadedParts: { ETag: string; PartNumber: number }[] =[];

                    try {
                        for (let chunkStart = 0; chunkStart < totalParts; chunkStart += 4) {
                            const partNumbers = [];
                            for (let j = 0; j < 4 && chunkStart + j < totalParts; j++) {
                                partNumbers.push(chunkStart + j + 1);
                            }
                            const urlsRes = await getMultipartPreSignedUrls(multiKey, uploadId, partNumbers);
                            if (!urlsRes.success || !urlsRes.urls) throw new Error("Failed to get chunk urls");
                            const uploadPromises = urlsRes.urls.map(async (u) => {
                                const partNum = u.partNumber;
                                const startByte = (partNum - 1) * CHUNK_SIZE;
                                const endByte = Math.min(startByte + CHUNK_SIZE, file.size);
                                const blob = file.slice(startByte, endByte);
                                const chunkRes = await fetch(u.url, {
                                    method: "PUT",
                                    body: blob
                                });

                                if (!chunkRes.ok) throw new Error(`Chunk ${partNum} failed`);
                                const eTag = chunkRes.headers.get("ETag") || chunkRes.headers.get("etag");
                                if (!eTag) throw new Error(`Missing Etag in chnk ${partNum} resp`);
                                uploadedParts.push({ ETag: eTag.replace(/"/g, ''), PartNumber: partNum });
                            });

                            await Promise.all(uploadPromises);
                        }

                        const completeRes = await completeMultipartUpload(multiKey, uploadId, uploadedParts);
                        if (!completeRes.success) throw new Error("failed to stich file together");
                        await recordMediaUpload({
                            filename: file.name,
                            mimetype: file.type,
                            size: file.size,
                            objectKey: multiKey,
                            storageBackendId: multiBackendId,
                            albumName
                        });
                        successCount++;
                    } catch (err) {
                        console.error("multipart failed", err);
                        await abortMultipartUpload(multiKey, uploadId);
                        throw err;
                    }
                }

                else {
                    setProgress(`Uploading ${i + 1}/${totalFiles}...`);

                    const uploadRes = await fetch(presignedUrl, {
                        method: "PUT",
                        body: file,
                        headers: { "Content-Type": file.type },
                    });

                    if (!uploadRes.ok) {
                        throw new Error(`failed to upload ${file.name} to bucket`); // I have made so many typos ;-;
                    }

                    await recordMediaUpload({
                        filename: file.name,
                        mimetype: file.type,
                        size: file.size,
                        objectKey: objectKey,
                        storageBackendId: backendId,
                        albumName
                    });
                    successCount++;
                }
            }

            if (successCount > 0) {
                const dupmsg = duplicatedCount > 0 ? ` (${duplicatedCount} duplicates) ` : "";
                notify("success", "Upload Complete", `successfully uploaded ${successCount} files${dupmsg}`); 
            }
            if (skippedCount > 0) notify("info", "Files Skipped", `${skippedCount} files were skipped (unsupported format)`);
        } catch (err: any) {
            console.error("batch upload failed", err);
            notify("error", "Upload Failed", err.message || "unknown error");
        } finally {
            setLoading(false);
            setProgress("");
            if (e.target) e.target.value = "";
        }
    };

            

    return (
        <label className="flex items-center gap-2 px-4 py-1.5 bg-transparent hover:bg-surface-hover border-border text-foreground rounded-full cursor-pointer transition-all text-sm font-medium disabled:opacity-50">
            <UploadCloud className="w-4 h-4"></UploadCloud>
            {loading ? progress : "Upload"}
            <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={onFileSelect} disabled={loading} {...({ webkitdirectory: "true" } as any)}/>
        </label>
    );
}