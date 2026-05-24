import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from '@/lib/env'

const globalForDb = globalThis as unknown as {
    conn: postgres.Sql | undefined;
};

const conn = globalForDb.conn ?? postgres(env.DATABASE_URL, { prepare: false, max: 30, idle_timeout: 20, connect_timeout: 10, });

if (process.env.NODE_ENV !== 'production') {
    globalForDb.conn = conn;
}

export const db = drizzle(conn, { schema });