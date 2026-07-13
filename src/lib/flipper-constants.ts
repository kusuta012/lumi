export type FlipperKey =
    | "uploads_enabled"
    | "sharing_enabled"
    | "registration_enabled"
    | "ai_processing_enabled"
    | "public_albums_enabled"
    | "downloads_enabled"
    | "takeouts_enabled"
    | "face_clustering_enabled"
    | "trash_empty_enabled";

export const FLIPPER_DEFAULTS: Record<FlipperKey, boolean> = {
    uploads_enabled: true,
    sharing_enabled: true,
    registration_enabled: true,
    ai_processing_enabled: true,
    public_albums_enabled: true,
    downloads_enabled: true,
    takeouts_enabled: true,
    face_clustering_enabled: true,
    trash_empty_enabled: true,
};

export const FLIPPER_COOLDOWNS: Record<FlipperKey, number> = {
    uploads_enabled: 5,
    sharing_enabled: 5,
    registration_enabled: 30,
    downloads_enabled: 10,
    public_albums_enabled: 5,
    ai_processing_enabled: 120,
    takeouts_enabled: 300,
    face_clustering_enabled: 300,
    trash_empty_enabled: 300
};

export const FLIPPER_META: { key: FlipperKey; label: string; desc: string; danger?: boolean }[] = [
    { key: "uploads_enabled", label: "Media Uploads", desc: "Allow users to upload new media" },
    { key: "sharing_enabled", label: "Share Links", desc: "Allow creation of shareable links"},
    { key: "registration_enabled", label: "Public Registration", desc: "Allow new users to sign up" },
    { key: "ai_processing_enabled", label: "AI Processing", desc: "Run ML processing on new uploads" },
    { key: "public_albums_enabled", label: "Public Album Viewing", desc: "Allow public access to shared albums" },
    { key: "downloads_enabled", label: "Original Downloads", desc: "Allow downloading original media files" },
    { key: "takeouts_enabled", label: "Takeouts", desc: "Allow imports/exports of media", danger: true },
    { key: "face_clustering_enabled", label: "Face Clustering", desc: "Run heavy vetctor matching for faces", danger: true },
    { key: "trash_empty_enabled", label: "Auto-Empty Trash", desc: "Allow Permanent deletion of 30 day old Trash", danger: true },
];