"use client";

import { useTransition } from "react";
import { toggleUserStatus, updateUserQuotaAction, changeUserRole } from "@/server/actions/admin-actions";
import { Edit2 } from "lucide-react";
import { useNotification } from "../providers/NotificationProvider";
import { useRouter } from "next/navigation";

export default function UserManagementTable({ users, roles }: { users: any[]; roles: any[] }) {
    const [isPending, startTransition] = useTransition();
    const { notify } = useNotification();
    const router = useRouter();

    const handleEditUserQuota = (userId: string, currentGB: number) => {
        const newGb = prompt("Enter new storage limit (GB):", currentGB.toString());
        if (newGb && !isNaN(Number(newGb))) {
            const gbNum = Number(newGb);
            if (gbNum < 1) {
                notify("info", "Exception", "Quota must br at least 1 GB");
                return;
            }
            startTransition(async () => { await updateUserQuotaAction(userId, gbNum * 1024)
        });
        }
    };

    const handleRoleChange = (userId: string, roleId: string) => {
        startTransition(async () => {
            const res = await changeUserRole(userId, roleId);
            if(res.success) {
                notify("success", "Role Changed", "User must re-login for changes to take effect");
                router.refresh();
            } else {
                notify("error", "Error", res.error || "Failed to change role");
            }
        });
    };

    return (
        <table className="w-full text-left border-collapse font-sans">
            <thead>
                <tr className="border-b border-border text-[10px] text-muted font-black tracking-widest">
                    <th className="py-3 px-2">Account</th>
                    <th className="py-3 px-2">Role</th>
                    <th className="py-3 px-2">Storage (Used / Limit)</th>
                    <th className="py-3 px-2 text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="text-sm">
                {users.map((u) => {
                    const quotaGB = (u.storageQuota / 1024 ).toFixed(1);
                    const usedGB = (u.storageUsed / 1024).toFixed(2);
                    const isSuperAdmin = u.role.name === "Super Admin";
                    return (
                        <tr key={u.id} className="border-b border-border group hover:bg-surface-hover">
                            <td className="py-4 px-2">
                                <span className="text-foreground font-bold block">{u.username}</span>
                                <span className="text-muted text-xs font-mono">{u.email}</span>
                            </td>
                            <td className="py-4 px-2">
                                {isSuperAdmin ? (
                                    <span className={`text-[10px] font-black px-2 py-0.5 border ${u.role.name === 'Super Admin' ? 'border-orange-500 text-orange-500' : 'border-border text-muted'}`}>
                                        SUPER ADMIN
                                    </span>
                                ) : (
                                    <select
                                        value={u.roleId}
                                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                        disabled={isPending}
                                        className="bg-surface-hover border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50 disabled:opacity-50">
                                            {roles.filter(r => r.name !== "Super Admin").map(r => (
                                                <option key={r.id} value={r.id}>{r.name}</option>
                                            ))}
                                        </select>
                                )}
                            </td>
                            <td className="py-4 px-2">
                                <div className="flex items-center gap-3">
                                    <span className="text-foreground font-mono">{usedGB} / {quotaGB} GB</span>
                                    <button onClick={() => handleEditUserQuota(u.id, Number(quotaGB))} className="text-orange-500 hover:text-foreground transition-colors">
                                        <Edit2 size={12} />
                                    </button>
                                </div>
                            </td>
                            <td className="py-4 px-2 text-right">
                                {!isSuperAdmin && (
                                    <button disabled={isPending} onClick={() => { startTransition(async () => { await toggleUserStatus(u.id, u.isSuspended); }); }} className={`text-[10px] font-bold border px-2 py-1 ${u.isSuspended ? 'border-green-600 text-green-600 hover:bg-green-600 hover:text-background': 'border-red-600 text-red-600 hover:bg-red-600 hover:text-background'}`}>
                                        {u.isSuspended ? "Unsuspend" : "Suspend"}
                                    </button>
                                )}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}