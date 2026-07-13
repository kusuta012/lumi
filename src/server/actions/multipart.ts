"use server";

import { S3Client, CreateMultipartUploadCommand, CompleteMultipartUploadCommand, UploadPartCommand, AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db } from "@/db";
import { storageBackends } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/server/auth";
import { env } from "@/lib/env";
import { isFlipperEnabled } from "@/lib/flippers";

async function getS3Client() {
    const defaultBackend = await db.query.storageBackends.findFirst({
        where: eq(storageBackends.isDefault, true)
    });
    const config = defaultBackend?.config as any;
    const endpoint = config?.endpoint || config?.endPoint || env.MINIO_ENDPOINT;
    const port = config?.port || env.MINIO_PORT;
    const useSSL = config?.useSSL ?? env.MINIO_USE_SSL;

    const s3 = new S3Client({
        region: "india",
        endpoint: `${useSSL ? 'https' : 'http'}://${endpoint}:${port}`,
        credentials: {
            accessKeyId: config?.accessKey || env.MINIO_ACCESS_KEY,
            secretAccessKey: config?.secretAccessKey || env.MINIO_SECRET_KEY,
        },
        forcePathStyle: true,
    });
    return { s3, bucket: (config?.bucket as string) || env.MINIO_BUCKET, backendId: defaultBackend?.id || null };
}

export async function initMultipartUpload(filename: string, contentType: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const uploadsOn = await isFlipperEnabled("uploads_enabled");
    if (!uploadsOn) throw new Error("Uploads are currently disabled by the administrator");

    try {
        const { s3, bucket, backendId } = await getS3Client();
        const fileId = crypto.randomUUID();
        const ext = filename.split(`.`).pop();
        const objectKey = `users/${session.user.id}/${fileId}-${ext}`;
        const command = new CreateMultipartUploadCommand({
            Bucket: bucket,
            Key: objectKey,
            ContentType: contentType,
        });
        const response = await s3.send(command);
        return {
            success: true,
            uploadId: response.UploadId,
            objectKey,
            backendId
        };
    } catch (err) {
        console.error("multipart error", err);
        return { success: false, error: "failed to intialize uplaod" };
    }
}

export async function getMultipartPreSignedUrls(objectKey: string, uploadId: string, partNumbers: number[]) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    try {
        const { s3, bucket } = await getS3Client();
        const urls: { partNumber: number; url: string }[] = [];

        for (const partNumber of partNumbers) {
            const command = new UploadPartCommand({
                Bucket: bucket,
                Key: objectKey,
                UploadId: uploadId,
                PartNumber: partNumber,
            });
            const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
            urls.push({ partNumber, url });
        }
        return { success: true, urls };
    } catch (err) {
        console.error("presigned multipart error", err);
        return { success: false, error: "Failed  to generate chunk urls" };
    }
}

export async function completeMultipartUpload(objectKey: string, uploadId: string, parts: { ETag: string; PartNumber: number }[]) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthroized");

    try {
        const { s3, bucket } = await getS3Client();
        const sortedParts = parts.sort((a, b) => a.PartNumber - b.PartNumber);
        const command = new CompleteMultipartUploadCommand({
            Bucket: bucket,
            Key: objectKey,
            UploadId: uploadId,
            MultipartUpload: {
                Parts: sortedParts,
            },
        });
        await s3.send(command);
        return { success: true };
    } catch (err) {
        console.error("multipart error", err);
        return { success: false, error: "Failed to stich video chunks together" }
    }
}

export async function abortMultipartUpload(objectKey: string, uploadId: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false };

    try {
        const { s3, bucket } = await getS3Client();
        const command = new AbortMultipartUploadCommand({
            Bucket: bucket,
            Key: objectKey,
            UploadId: uploadId,
        });
        await s3.send(command);
        return { success: true };
    } catch (err) {
        return { success: false };
    }
}