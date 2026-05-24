"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { createPortal } from "react-dom";

export type NotifType = 'success' | 'error' | 'info';
export interface Notification {
    id: string;
    type: NotifType;
    title: string;
    message?: string;
    createdAt: Date;
    showToast: boolean;
    read: boolean;
}

interface NotificationContextType {
    notifications: Notification[];
    notify: (type: NotifType, title: string, message?: string) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    clearAll: () => void;
    dismissToast: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotification() {
    const context = useContext(NotificationContext);
    if (!context) throw new Error("useNotifcation must be use withinnn ua notfiacaiton provided");
    return context;
} // gng I'm low on energy , I need monsterrrrrrrrrr RAHHH

export default function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem("lumi_notifications");
        if (saved) {
            try {
                const parsed = JSON.parse(saved).map((n: any) => ({
                    ...n,
                    createdAt: new Date(n.createdAt),
                    showToast: false
                }));
                setNotifications(parsed);
            } catch (e) {
                console.error("Failed to parse saved notifications");
            }
        }
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        if (mounted) {
            localStorage.setItem("lumi_notifications", JSON.stringify(notifications));
        }
    }, [notifications, mounted]);

    const notify = useCallback((type: NotifType, title: string, message?: string) => {
        const id = crypto.randomUUID();
        const newNotif: Notification = { id, type, title, message, createdAt: new Date(), showToast: true, read: false };
        setNotifications(prev => [newNotif, ...prev]);

        setTimeout(() => {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, showToast: false } : n));
        }, 4000);
    }, []);

    const markAsRead = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    const markAllAsRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    const clearAll = () => setNotifications([]);
    const dismissToast = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, showToast: false } : n));

    return (
        <NotificationContext.Provider value={{ notifications, notify, markAsRead, markAllAsRead, clearAll, dismissToast }}>
            {children}
            {mounted && createPortal(
                <div className="fixed bottom-6 right-6 z-[999999] flex flex-col gap-3 pointer-events-none">
                    {notifications.filter(n => n.showToast).map(n => (
                        <div key={n.id} className="pointer-events-auto w-80 bg-surface border border-border rounded-xl shadow-2xl p-4 flex items-start gap-3 animate-in slide-in-from-right-8 fade-in duration-300">
                            <div className="shrink-0 mt-0.5">
                                {n.type === 'success' && <CheckCircle2 className="text-emerald-500 w-5 h-5" />}
                                {n.type === 'error' && <AlertCircle className="text-red-500 w-5 h-5" />}
                                {n.type === 'info' && <Info className="text-blue-500 w-5 h-5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-foreground truncate">{n.title}</h4>
                                {n.message && <p className="text-xs text-muted mt-1 line-clamp-2">{n.message}</p>}
                            </div>
                            <button onClick={() => dismissToast(n.id)} className="text-muted hover:text-foreground transition-colors shrink-0">
                                <X size={16} />
                            </button>
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </NotificationContext.Provider>
    );
}