"use client";

import { useTransition, useRef } from "react";
import { addStorageBackend } from "@/server/actions/storage-actions";

export default function StorageBackendForm() {
    const [isPending, startTransition] = useTransition();
    const formRef = useRef<HTMLFormElement>(null);
    const handleAction = (formData: FormData) => {
        const data = {
            name: formData.get("name") as string,
            type: formData.get("type") as string,
            config: {
                endpoint: formData.get("endpoint") as string,
                bucket: formData.get("bucket") as string,
                port: formData.get("port") as string,
                accessKey: formData.get("accessKey") as string,
                secretKey: formData.get("secretKey") as string,
            }
        };

        startTransition(async () => {
            await addStorageBackend(data);
            formRef.current?.reset();
        });
    };

    return (
        <form ref={formRef} action={handleAction} className="space-y-4">
            <h2 className="text-foreground font-bold text-sm mb-4">mount new storage</h2>
            <div className="grid grid-cols-2 gap-4">
                <input name="name" placeholder="Name" required className="bg-surface border border-border text-sm p-2 text-foreground outline-none focus:border-orange-500" />
                <select name="type" className="bg-surface border border-border text-sm p-2 text-foreground outline-none focus:border-orange-500">
                    <option value="minio">MinIO / S3</option>
                </select>
                <input name="endpoint" placeholder="Endpoint / Path" required className="col-span-2 bg-surface border border-border text-sm p-2 text-foreground outline-none focus:border-orange-500" />
                <input name="port" placeholder="Port" className="col-span-2 bg-surface border border-border text-sm p-2 text-foreground outline-none focus:border-orange-500" />
                <input name="bucket" placeholder="Bucket Name" required className="col-span-2 bg-surface border border-border text-sm p-2 text-foreground outline-none focus:border-orange-500" />
                <input name="accessKey" placeholder="Access Key" required className="col-span-2 bg-surface border border-border text-sm p-2 text-foreground outline-none focus:border-orange-500" />
                <input name="secretKey" placeholder="Secret Key" type="password" required className="col-span-2 bg-surface border border-border text-sm p-2 text-foreground outline-none focus:border-orange-500" />
            </div>
            <button type="submit" disabled={isPending} className="w-full mt-4 py-2 border border-border text-foreground font-bold text-xs hover:bg-foreground hover:text-background transition-colors disabled:opacity-50">
                {isPending ? "Registering.." : "Register Backend"}
            </button>
        </form>
    );
}