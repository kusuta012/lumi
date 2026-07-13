export type PermissionKey =
    | "can_manage_users"
    | "can_manage_server"
    | "can_view_analytics"
    | "can_change_config"
    | "can_manage_flippers"
    | "can_view_audit_log"
    | "can_manage_others_albums"
    | "can_view_all_media"
    | "can_override_quota";

export type Permissions = Record<PermissionKey, boolean>;

export const ALL_PERMISSIONS: { key: PermissionKey; label: string; description: string; }[] = [
    { key: "can_manage_users", label: "Manage Users", description: "Create, edit, suspend, delete users" },
    { key: "can_manage_server", label: "Manage Server", description: "Access admin dashboard, view service health" },
    { key: "can_view_analytics", label: "View Analytics", description:  "View platform stats and storage usage" },
    { key: "can_change_config", label: "Change Config", description: "Toggle registration, maintenance, transcoding" },
    { key: "can_manage_flippers", label: "Manage Flippers", description: "Toggle feature flags" },
    { key: "can_view_audit_log", label: "View Audit Log", description: "Access the audit log page" },
    { key: "can_manage_others_albums", label: "Manage Others Albums", description: "Edit or delete any user's albums" },
    { key: "can_view_all_media", label: "View All Media", description: "Browse any user's media for moderation" },
    { key: "can_override_quota", label: "Override Quota", description: "Bypass own storage quota limits" },
];

export function hasAnyAdminPerm(perms: Permissions | undefined): boolean {
    if (!perms) return false;
    return perms.can_manage_server || perms.can_manage_users || perms.can_view_analytics || perms.can_view_audit_log;
}