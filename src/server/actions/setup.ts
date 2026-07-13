"use server";

import { db } from "@/db";
import { users, roles, platformConfig, storageBackends } from "@/db/schema";
import { isSetupComplete } from "../queries/setup";
import { hash } from "bcrypt";
import { redirect } from "next/navigation";
import { FLIPPER_DEFAULTS } from "@/lib/flipper-constants";
import { Client } from "minio";
import { env } from "@/lib/env";
import { BLOOM_KEYS, bloomFilter } from "@/lib/bloom";

export async function testStorageConnection(data: {
    endpoint: string;
    port: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    useSsl: boolean;
}) {
    try {
        const client = new Client({
            endPoint: data.endpoint,
            port: parseInt(data.port) || 9000,
            useSSL: data.useSsl,
            accessKey: data.accessKey,
            secretKey: data.secretKey,
        });

        const exists = await client.bucketExists(data.bucket);
        if (!exists) {
            await client.makeBucket(data.bucket, "");
        }
        return { success: true, message: "Connected Successfully" };
    } catch (err: any) {
        console.error("Storage connection test failed", err);
        const msg = err.code === "ECONNREFUSED"
            ? "Connection refused, Is the storage server running?"
            : err.code === "ENOTFOUND"
            ? "Hostname not found, check the endpoint"
            : err.message?.includes("AccessDenied") || err.message?.includes("InvalidAccessKeyId")
            ? "Invalid credentials, check your access key and secret"
            : `Connection failed ${err.message || "Unknown error"}`;
        return { success: false, message: msg };
    }
}

export async function completeSetupAction(prevState: any, formData: FormData) {
    const username = formData.get("username") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;
    const storageType = formData.get("storageType") as string;

    if (!username || username.length < 3) {
        return { error: "Username must be at least 3 characters" };
    }

    if (!email) {
        return { error: "Email is required" };
    }

    if (!password || password.length < 8) {
        return { error: "Password must be at least 8 characters" };
    }

    if (password !== confirmPassword) {
        return { error: "password does not match"};
    }

    const alreadySetup = await isSetupComplete();
    if (alreadySetup) {
        redirect("/login");
    }
    try {
        const [superAdminRole] = await db.insert(roles).values({
            name: 'Super Admin',
            isSystem: true, 
            permissions: {
                can_manage_users: true,
                can_manage_server: true,
                can_view_analytics: true,
                can_change_config: true,
                can_manage_flippers: true,
                can_view_audit_log: true,
                can_manage_others_albums: true,
                can_view_all_media: true,
                can_override_quota: true,
            }
        }).returning();

        await db.insert(roles).values({
            name: "Default User",
            isSystem: true,
            permissions: {
                can_manage_users: false,
                can_manage_server: false,
                can_view_analytics: false,
                can_change_config: false,
                can_manage_flippers: false,
                can_view_audit_log: false,
                can_manage_others_albums: false,
                can_view_all_media: false,
                can_override_quota: false,
            },
        }).onConflictDoNothing();

        const passwordHash = await hash(password, 10);
        await db.insert(users).values({
            username, 
            email,
            passwordHash,
            roleId: superAdminRole.id,
        });

        await Promise.all([
            bloomFilter.add(BLOOM_KEYS.USERNAMES, username),
            bloomFilter.add(BLOOM_KEYS.EMAILS, email),
        ]);

        if (storageType === "custom") {
            const s3Endpoint = formData.get("s3Endpoint") as string;
            const s3Port = formData.get("s3Port") as string;
            const s3AccessKey = formData.get("s3AccessKey") as string;
            const s3SecretKey = formData.get("s3SecretKey") as string;
            const s3Bucket = formData.get("s3Bucket") as string;
            const s3Ssl = formData.get("s3Ssl") === "true";

            if (s3Endpoint && s3AccessKey && s3SecretKey) {
                await db.insert(storageBackends).values({
                    name: "Primary Storage",
                    type: "s3",
                    isDefault: true,
                    config: {
                        endPoint: s3Endpoint,
                        port: parseInt(s3Port) || 9000,
                        accessKey: s3AccessKey,
                        secretAccessKey: s3SecretKey,
                        bucket: s3Bucket || "lumi",
                        useSSL: s3Ssl,
                    },
                });
            }
        }

        await db.insert(platformConfig)
            .values({ key: "feature_flippers", value: FLIPPER_DEFAULTS })
            .onConflictDoNothing();
        
        await db.insert(platformConfig)
            .values({
                key: "ai_settings",
                value: {
                    clip_enabled: true,
                    face_detection_enabled: true,
                    ocr_enabled: true,
                    aesthetic_scoring_enabled: true,
                    auto_tagging_enabled: true,
                    face_confidence_threshold: 0.85,
                    face_distance_threshold: 0.40,
                },
            })
            .onConflictDoNothing();
    } catch (error) {
        console.error("setup failed", error);
        return { error: "Failed to complete setup, Check server logs" };
    }

    redirect("/login");
}