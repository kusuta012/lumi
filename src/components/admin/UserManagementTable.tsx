"use client";

import { useTransition } from "react";
import { toggleUserStatus, updateUserQuotaAction } from "@/server/actions/admin-actions";
import { UserMinus, UserCheck, Edit2 } from "lucide-react";
import { useNotification } from "../providers/NotificationProvider";

export default function UserManagementTable({ users }: { users: any[] }) {
    const [isPending, startTransition] = useTransition();
    const { notify } = useNotification();

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

    return (
        <table className="w-full text-left border-collapse font-sans">
            <thead>
                <tr className="border-b border-neutral-800 text-[10px] text-neutral-500 font-black tracking-widest">
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

                    return (
                        <tr key={u.id} className="border-b border-neutral-900 group hover:bg-white/[0.02]">
                            <td className="py-4 px-2">
                                <span className="text-white font-bold block">{u.username}</span>
                                <span className="text-neutral-500 text-xs font-mono">{u.email}</span>
                            </td>
                            <td className="py-4 px-2">
                                <span className={`text-[10px] font-black px-2 py-0.5 border ${u.role.name === 'Super Admin' ? 'border-orange-500 text-orange-500' : 'border-neutral-700 text-neutral-500'}`}>
                                    {u.role.name.toUpperCase()}
                                </span>
                            </td>
                            <td className="py-4 px-2">
                                <div className="flex items-center gap-3">
                                    <span className="text-white font-mono">{usedGB} / {quotaGB} GB</span>
                                    <button onClick={() => handleEditUserQuota(u.id, Number(quotaGB))} className="text-orange-500 hover:text-white transition-colors">
                                        <Edit2 size={12} />
                                    </button>
                                </div>
                            </td>
                            <td className="py-4 px-2 text-right">
                                {u.role.name !== 'Super Admin' && (
                                    <button disabled={isPending} onClick={() => { startTransition(async () => { await toggleUserStatus(u.id, u.isSuspended); }); }} className={`text-[10px] font-bold border px-2 py-1 ${u.isSuspended ? 'border-green-600 text-green-600 hover:bg-green-600 hover:text-black': 'border-red-600 text-red-600 hover:bg-red-600 hover:text-black'}`}>
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