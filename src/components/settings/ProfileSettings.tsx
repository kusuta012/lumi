"use client";

import { useState, useTransition, useRef } from "react";
import { updateUsername, updatePassword, uploadAvatar } from "@/server/actions/profile-actions";
import { useNotification } from "../providers/NotificationProvider";
import { Camera, Loader2, Save } from "lucide-react";

export default function ProfileSettings({ user }: { user: any }) {
    const { notify } = useNotification();
    const [isPending, startTransition] = useTransition();
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [avatar, setAvatar] = useState(user.avatarUrl);
    const [username, setUsername] = useState(user.username);

    const [currentPass, setCurrentPass] = useState("");
    const [newPass, setNewPass] = useState("");
    const [confirmPass, setConfirmPass] = useState("");

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData(); 
        formData.append("file", file);

        startTransition(async () => {
            const res = await uploadAvatar(formData);
            if (res.success) {
                setAvatar(res.avatarUrl);
                notify("success", "Updated", "Profile picture updated successfully");
            } else {
                notify("error", "Error", res.error || "Failed to upload picture");
            }
        });
    };

    const handleUsernameSave = () => {
        startTransition(async () => {
            const res = await updateUsername(username);
            if (res.success) {
                notify("success", "Updated", "Username updated successfully");
            } else {
                notify("error", "Error", res.error || "Failed to update username");
            }
        });
    };

    const handlePasswordSave = () => {
        startTransition(async () => {
            const res = await updatePassword(currentPass, newPass, confirmPass);
            if (res.success) {
                setCurrentPass("");
                setNewPass("");
                setConfirmPass("");
                notify("success", "Updated", "Password updated successfully");
            } else {
                notify("error", "Error", res.error || "Failed to update password");
            }
        });
    };

    const inputClass = "w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground placeholder:text-muted/50 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors text-sm";

    return (
        <div className="space-y-10">
            <div>
                <h2 className="text-lg font-bold text-foreground mb-4">Basic Info</h2>
                <div className="flex items-center gap-6">
                    <div className="relative group">
                        <div className="w-24 h-24 rounded-full bg-surface-hover border-2 border-border overflow-hidden flex items-center justify-center shrink-0">
                            {avatar ? (
                                <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-3xl font-bold text-muted">{username.charAt(0).toUpperCase()}</span>
                            )}
                        </div>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled = {isPending}
                            className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                {isPending ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white "/>}
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                    </div>
                    <div className="flex-1 space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-foreground mb-1">Username</label>
                            <div className="flex-gap-2">
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className={inputClass}
                                />
                                <button
                                    onClick={handleUsernameSave}
                                    disabled={isPending || username === user.username}
                                    className="px-4 py-2 bg-surface-hover hover:bg-border border border-border rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                                    <Save size={16} />        
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="pt-8 border-t border-border">
                <h2 className="text-lg font-bold text-foreground mb-4">Change Password</h2>
                <div className="space-y-4 max-w-md">
                    <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Current Password</label>
                        <input
                            type="password"
                            value={currentPass}
                            onChange={(e) => setCurrentPass(e.target.value)}
                            className={inputClass}
                            />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-foreground mb-1">New Password</label>
                        <input
                            type="password"
                            value={newPass}
                            onChange={(e) => setNewPass(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Confirm New Password</label>
                        <input
                            type="password"
                            value={confirmPass}
                            onChange={(e) => setConfirmPass(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                    <button
                        onClick={handlePasswordSave}
                        disabled={isPending || !currentPass || !newPass || !confirmPass}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        {isPending ? "Saving..." : "Update Password"}
                    </button>
                </div>
            </div>
        </div>
    );
}