"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/server/auth";
import { eq } from "drizzle-orm";
import qrcode from "qrcode";
import { revalidatePath } from "next/cache";
import * as OTPAuth from "otpauth";

export async function generateMfaSetup() {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const secret = new OTPAuth.Secret({ size: 20 });
    const secretBase32 = secret.base32;

    const totp = new OTPAuth.TOTP({
        issuer: "Lumi",
        label: session.user.name!,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: secretBase32
    });

    const qrCodeUrl = await qrcode.toDataURL(totp.toString());
    return { secret: secretBase32, qrCodeUrl };
}

export async function enableMfa(secret: string, token: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const totp = new OTPAuth.TOTP({
        issuer: "Lumi",
        label: session.user.name!,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: secret
    });
    const delta = totp.validate({
        token: token,
        window: 1
    });

    const isValid = delta !== null;

    if (!isValid) {
        return { success: false, error: "Invalid verification code" }
    }

    await db.update(users)
        .set({
            mfaEnabled: true,
            mfaSecret: secret
        })
        .where(eq(users.id, session.user.id));

    revalidatePath("/admin/users");
    return { success: true };
}

export async function disableMfa() {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    await db.update(users)
        .set({
            mfaEnabled: false,
            mfaSecret: null
        })
        .where(eq(users.id, session.user.id));
    
    revalidatePath("/admin/users");
    return { success: true };
}
