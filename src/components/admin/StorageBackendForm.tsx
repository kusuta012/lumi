"use client";

import { useTransition, useRef } from "react";
import { addStorageBackend } from "@/server/actions/storage-actions";

export default function StorageBackendForm() {
    const [isPending, startTransition] = useTransition();
    const formRef = useRef<HTMLFormElement>(null);
    const handleAction = (formData: FormData) => {
        const data = {
            name: formData.get("name"),
            type: formData.get("type"),
            config: {
                endpoint: formData.get("endpoint"),
                bucket: formData.get("bucket"),
                port: formData.get("port"),
                accessKey: formData.get("accessKey"),
                secretKey: formData.get("secretKey"),
            }
        };

        startTransition(async () => {
            await addStorageBackend(data);
            formRef.current?.reset();
        });
    };

    return (
        <form ref={formRef} action={handleAction} className="space-y-4">
            <h2 className="text-white font-bold text-sm mb-4">mount new storage</h2>
            <div className="grid grid-cols-2 gap-4">
                <input name="name" placeholder="Name" required className="bg-[#111] border border-neutral-700 text-sm p-2 text-white outline-none focus:border-orange-500" />
                <select name="type" className="bg-[#111] border border-neutral-700 text-sm p-2 text-white outline-none focus:border-orange-500">
                    <option value="minio">MinIO / S3</option>
                </select>
                <input name="endpoint" placeholder="Endpoint / Path" required className="col-span-2 bg-[#111] border border-neutral-700 text-sm p-2 text-white outline-none focus:border-orange-500" />
                <input name="port" placeholder="Port" className="col-span-2 bg-[#111] border border-neutral-700 text-sm p-2 text-white outline-none focus:border-orange-500" />
                <input name="bucket" placeholder="Bucket Name" required className="col-span-2 bg-[#111] border border-neutral-700 text-sm p-2 text-white outline-none focus:border-orange-500" />
                <input name="accessKey" placeholder="Access Key" required className="col-span-2 bg-[#111] border border-neutral-700 text-sm p-2 text-white outline-none focus:border-orange-500" />
                <input name="secretKey" placeholder="Secret Key" type="password" required className="col-span-2 bg-[#111] border border-neutral-700 text-sm p-2 text-white outline-none focus:border-orange-500" />
            </div>
            <button type="submit" disabled={isPending} className="w-full mt-4 py-2 border border-neutral-600 text-neutral-300 font-bold text-xs hover:bg-white hover:text-black transition-colors disabled:opacity-50">
                {isPending ? "Registering.." : "Register Backend"}
            </button>
        </form>
    );
}