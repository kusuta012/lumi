import "dotenv/config";
import { execa } from "execa";
import { env } from "@/lib/env";
import fs from "fs/promises";
import path from "path";

async function restoreSystem() {
    const backupFile = process.argv[2];

    if (!backupFile) {
        console.error("Please provide the path to the backup file");
        process.exit(1);
    }

    const resolvedPath = path.resolve(backupFile);

    try {
        await fs.access(resolvedPath);
    } catch {
        console.error(`could not find file at ${resolvedPath}`);
        process.exit(1);
    }

    console.log(`WARNING: this will WIPE the current database and replace it with ${resolvedPath}`);
    console.log(`starting restore in 5 seconds... (PRess CtrI+C to abort)`);
    await new Promise(res => setTimeout(res, 5000));
    console.log(`Executing pg_restore`);

    try {
        await execa("pg_restore", [
            "--clean",
            "--if-exists",
            "--no-owner",
            "-Fc",
            "-d", env.DATABASE_URL,
            resolvedPath
        ], { stdio: 'inherit' });
        console.error(`Database restored successfully`);
        process.exit(0);
    } catch (err) {
        console.error(`error during restore`, err);
        process.exit(1);
    }
}

restoreSystem().catch(console.error);