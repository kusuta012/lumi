"use server";

import { signIn } from "../auth";
import { AuthError } from "next-auth";

export type LoginState = {
    error?: string;
} | null;

export async function loginAction(prevstate: any, formData: FormData) {
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