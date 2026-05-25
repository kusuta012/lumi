function getEnv(key: string, required = true): string {
    const value = process.env[key];
    if (required && !value) {
        throw new Error(`CONFIG EROR, env variable ${key} missing`);
    }
    return value || "";
}

export const env = {
    DATABASE_URL: getEnv("DATABASE_URL"),
    REDIS_URL: getEnv("REDIS_URL"),
    MINIO_ENDPOINT: getEnv("MINIO_ENDPOINT"),
    MINIO_PORT: parseInt(getEnv("MINIO_PORT")),
    MINIO_USE_SSL: getEnv("MINIO_USE_SSL") === "true",
    MINIO_ACCESS_KEY: getEnv("MINIO_ACCESS_KEY"),
    MINIO_SECRET_KEY: getEnv("MINIO_SECRET_KEY"),
    MINIO_BUCKET: getEnv("MINIO_BUCKET"),
    AUTH_SECRET: getEnv("AUTH_SECRET"),
    APP_URL: getEnv("NEXT_PUBLIC_APP_URL"),
    ML_API_URl: getEnv("ML_API_URL", false)
};