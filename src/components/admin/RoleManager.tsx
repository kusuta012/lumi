"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Edit2, X, Check, Users } from "lucide-react";
import { createRole, updateRole, deleteRole } from "@/server/actions/admin-actions";
import { ALL_PERMISSIONS, type Permissions, type PermissionKey } from "@/lib/permissions";
import { useRouter } from "next/navigation";
import { useNotification } from "../providers/NotificationProvider";

const DEFAULT_PERMS: Permissions = {
    can_manage_users: false,
    can_manage_server: false,
    can_view_analytics: false,
    can_change_config: false,
    can_manage_flippers: false,
    can_view_audit_log: false,
    can_manage_others_albums: false,
    can_view_all_media: false,
    can_override_quota: false,
};

export default function RoleManager({ roles }: { roles: any[] }) {
    const router = useRouter();
    const { notify } = useNotification();
    const [isPending, startTransition] = useTransition();
    const [showCreate, setShowCreate] = useState(false);
    const [editingId, setEditingId] = useState<string  | null>(null);
    const [formName, setFormName] = useState("");
    const [formPerms, setFormPerms] = useState<Permissions>(DEFAULT_PERMS);
    const togglePerm  = (key: PermissionKey) => {
        setFormPerms(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleCreate = () => {
        if (!formName.trim()) return;
        startTransition(async () => {
            const res = await createRole(formName, formPerms);
            if (res.success) {
                notify("success", "Created", `Role "${formName}" created`);
                setShowCreate(false);
                setFormName("");
                setFormPerms(DEFAULT_PERMS);
                router.refresh();
            } else {
                notify("error", "Error", res.error || "Failed to create role");
            }
        });
    };

    const handleUpdate = (roleId: string) => {
        if (!formName.trim()) return;
        startTransition(async () => {
            const res = await updateRole(roleId, formName, formPerms);
            if (res.success) {
                notify("success", "Updated", "Role updated");
                setEditingId(null);
                router.refresh();
            } else {
                notify("error", "Error", res.error || "Failed to update role");
            }
        });
    };

    const handleDelete = (roleId: string, roleName: string) => {
        if (!confirm(`Delete role "${roleName}"? This cannot be undone`)) return;
        startTransition(async () => {
            const res = await deleteRole(roleId);
            if (res.success) {
                notify("success", "Deleted", `Role "${roleName}" deleted`);
                router.refresh();
            } else {
                notify("error", "Error", res.error || "Failed to delete role");
            }
        });
    };

    const startEdit = (role: any) => {
        setEditingId(role.id);
        setFormName(role.name);
        setFormPerms(role.permissions);
    };

    return (
        <div className="space-y-6">
            <div className="space-y-3">
                {roles.map(role => (
                    <div key={role.id} className="border border-border bg-background p-5">
                        {editingId === role.id ? (
                            <div className="space-y-4">
                                <input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full bg-surface-hover border border-border rounded-lg px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
                                <PermissionGrid perms={formPerms} onToggle={togglePerm} />
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-sm text-muted hover:text-foreground border border-border rounded-lg">Cancel</button>
                                    <button onClick={() => handleUpdate(role.id)} disabled={isPending} className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-400 disabled:opacity-50">Save</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="font-bold text-foreground">{role.name}</span>
                                        {role.isSystem && (
                                            <span className="text-[10px] font-bold px-2 py-0.5 border border-orange-500/50 text-orange-500 rounded">SYSTEM</span>
                                        )}
                                        <span className="text-xs text-muted flex items-center gap-1">
                                            <Users size={12} /> {role.userCount} {role.userCount === 1 ? "user" : "users"}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {ALL_PERMISSIONS.map(p => (
                                            <span key={p.key} className={`text-[10px] font-bold px-2 py-0.5 border rounded ${role.permissions[p.key] ? 'border-green-600/50 text-green-500' : 'border-border text-muted/40'}`}>{p.label}</span>
                                        ))}
                                    </div>
                                </div>
                                {!role.isSystem && (
                                    <div className="flex gap-2 shrink-0">
                                        <button onClick={() => startEdit(role)} className="p-1.5 text-muted hover:text-foreground transition-colors">
                                            <Edit2 size={14} />
                                        </button>
                                        <button onClick={() => handleDelete(role.id, role.name)} disabled={isPending} className="p-1.5 text-red-500 hover:text-red-400 transition-colors disabled:opacity-50">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {showCreate ? (
                <div className="border border-orange-500/30 bg-background p-5 space-y-4">
                    <h3 className="font-bold text-foreground text-sm">Create New Role</h3>
                    <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Role name (e.g Moderator)" className="w-full bg-surface-hover border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-orange-500/50" autoFocus />
                    <PermissionGrid perms={formPerms} onToggle={togglePerm} />
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => { setShowCreate(false); setFormName(""); setFormPerms(DEFAULT_PERMS); }} className="px-4 py-2 text-sm text-muted hover:text-foreground border border-border rounded-lg">Cancel</button>
                        <button onClick={handleCreate} disabled={isPending || !formName.trim()} className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-400 disabled:opacity-50">Create Role</button>
                    </div>
                </div>
            ) : (
                <button onClick={() => setShowCreate(true)} className="w-full border border-dashed border-border p-4 text-sm text-muted hover:text-foreground hover:border-orange-500/50 transition-colors flex items-center justify-center gap-2">
                    <Plus size={16} /> Create New Role
                </button>
            )}
        </div>
    );
}

function PermissionGrid({ perms, onToggle }: { perms: Permissions; onToggle: (key: PermissionKey) => void }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {ALL_PERMISSIONS.map(p => (
                <button key={p.key} onClick={() => onToggle(p.key)} className={`flex items-center gap-3 p-3 border rounded-lg text-left transition-colors ${perms[p.key] ? 'border-green-600/50 bg-green-950/20' : 'border-border hover:border-border/80'}`}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${perms[p.key] ? 'bg-green-600 border-green-600' : 'border-muted'}`}>
                        {perms[p.key] && <Check size={10} className="text-white" />}
                    </div>
                    <div>
                        <span className={`text-xs font-bold block ${perms[p.key] ? 'text-green-500' : 'text-foreground'}`}>{p.label}</span>
                        <span className="text-[10px] text-muted">{p.description}</span>
                    </div>
                </button>
            ))}
        </div>
    );
}