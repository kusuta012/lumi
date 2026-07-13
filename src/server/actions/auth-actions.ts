"use server";

import { signIn } from "../auth";
import { AuthError } from "next-auth";
import * as OTPAuth from "otpauth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { compare } from "bcrypt";
import { checkRateLimit } from "@/lib/rate-limit";

export type LoginState = {
    error?: string;
    mfaRequired?: boolean;  
} | null;

export async function loginAction(prevstate: LoginState, formData: FormData): Promise<LoginState> {
    const rateLimit = await checkRateLimit("login", 5, 900);
    if (!rateLimit.allowed) {
        const minutesLeft = Math.ceil(rateLimit.ttl / 60);
        return { error: `Too many login attemps. Please try again later in ${minutesLeft} minutes` };
    }

    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const mfaToken = formData.get("mfaToken") as string;

    try {
        const user = await db.query.users.findFirst({
            where: eq(users.username, username)
        });
        
        if (!user || !user.passwordHash) {
            return { error: "Invalid username or password" };
        }

        const isPasswordValid = await compare(password, user.passwordHash);
        if (!isPasswordValid) {
            return { error: "Invalid username or password" };
        }

        if (user.isSuspended) {
            return { error: "Your account has been suspended" };
        }

        if (user.mfaEnabled) {
            if (!mfaToken) {
                return { mfaRequired: true };
            }

            const totp = new OTPAuth.TOTP({
                issuer: "Lumi",
                algorithm: "SHA1",
                digits: 6,
                period: 30,
                secret: user.mfaSecret!
            });

            const delta = totp.validate({
                token: mfaToken,
                window: 1
            });

            const isTokenValid = delta !== null;
            if (!isTokenValid) {
                return { error: "Incorrect 2FA code", mfaRequired: true };
            }
        }

        await signIn("credentials", {
            username,
            password,
            redirectTo: "/photos",
        });

        return null;
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case "CredentialsSignin":
                    return { error: "Invalid username or password" };
                default:
                    return { error: "somehthing went wrong, Please try again" };
            }
        }
        throw error;
    }
}