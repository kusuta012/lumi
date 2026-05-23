"use server";

import { signIn } from "../auth";
import { AuthError } from "next-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export type LoginState = {
    error?: string;
} | null;

export async function loginAction(prevstate: LoginState, formData: FormData): Promise<LoginState> {
    const rateLimit = await checkRateLimit("login", 5, 900);
    if (!rateLimit.allowed) {
        const minutesLeft = Math.ceil(rateLimit.ttl / 60);
        return { error: `Too many login attemps. Please try again later in ${minutesLeft} minutes` };
    }

    try {
        await signIn("credentials", {
            username: formData.get("username"),
            password: formData.get("password"),
            redirectTo: "/photos"
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