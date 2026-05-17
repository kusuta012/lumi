import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "@/db"
import { users , roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { compare } from "bcrypt";
import { env } from "@/lib/env";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            roleName: string;
        } & DefaultSession["user"]
    }

    interface User {
        roleName?: string;
    }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    adapter: DrizzleAdapter(db),
    session: {
        strategy: "jwt"
    },
    secret: env.AUTH_SECRET,
    pages: {
        signIn: "/login",
    },
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.username || !credentials?.password) return null;

                const user = await db.query.users.findFirst({
                    where: eq(users.username, credentials.username as string),
                    with: { role: true }
                });

                if (!user || !user.passwordHash) return null;

                const isValid = await compare(credentials.password as string, user.passwordHash);
                if (!isValid) return null;

                if (user.isSuspended) {
                    throw new Error("Your account has been suspended");
                }

                return {
                    id: user.id,
                    name: user.username,
                    email: user.email,
                    roleName: user.role.name
                };
            }
        })
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.roleName = (user as any).roleName;
            }
            return token;
        },
        
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string;
                (session.user as any).roleName = token.roleName as string;
            }
            return session;
        }
    }
});