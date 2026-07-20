"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Menu, LogOut, User, ShieldCheck, Users2, Check } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { useNotifications } from "@/hooks/useNotifications";

interface NavbarProps {
    onMenuClick: () => void;
}

function timeAgo(iso: string): string {
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
}

export function Navbar({ onMenuClick }: NavbarProps) {
    const router = useRouter();
    const { session } = useSession();
    const { notifications, unreadCount, markAllRead } = useNotifications(!!session);
    const [notifOpen, setNotifOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const notifRef = useRef<HTMLDivElement>(null);
    const profileRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
    };

    const initials = session?.name
        ? session.name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()
        : "?";

    return (
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-4 md:px-8 sticky top-0 z-30">
            <div className="flex items-center gap-4 flex-1">
                <button
                    onClick={onMenuClick}
                    className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    <Menu className="w-5 h-5" />
                </button>
            </div>

            <div className="flex items-center gap-3 md:gap-6">
                <div className="relative" ref={notifRef}>
                    <button
                        onClick={() => setNotifOpen((v) => !v)}
                        className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <Bell className="w-5 h-5" />
                        {unreadCount > 0 && (
                            <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 bg-red-500 rounded-full border-2 border-white text-[9px] leading-none flex items-center justify-center text-white font-bold">
                                {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                        )}
                    </button>
                    <AnimatePresence>
                        {notifOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                                transition={{ duration: 0.15 }}
                                className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden z-50"
                            >
                                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                                    <h3 className="font-semibold text-slate-900 text-sm">Notifications</h3>
                                    {unreadCount > 0 && (
                                        <button
                                            onClick={markAllRead}
                                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                        >
                                            <Check className="w-3 h-3" /> Mark all read
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                                    {notifications.length ? (
                                        notifications.map((n) => (
                                            <div key={n.id} className={`p-4 ${!n.read ? "bg-blue-50/50" : ""}`}>
                                                <p className="text-sm font-medium text-slate-900">{n.title}</p>
                                                <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>
                                                <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="p-6 text-center text-sm text-slate-400">No notifications yet.</p>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="h-8 w-px bg-slate-100 hidden sm:block"></div>

                <div className="relative" ref={profileRef}>
                    <button
                        onClick={() => setProfileOpen((v) => !v)}
                        className="flex items-center gap-2"
                    >
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                            {initials}
                        </div>
                    </button>
                    <AnimatePresence>
                        {profileOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                                transition={{ duration: 0.15 }}
                                className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden z-50"
                            >
                                <div className="p-4 border-b border-slate-100">
                                    <p className="font-semibold text-slate-900 text-sm">{session?.name ?? "Guest"}</p>
                                    <p className="text-xs text-slate-500 capitalize mt-0.5 flex items-center gap-1">
                                        <User className="w-3 h-3" /> {session?.role ?? "—"}
                                    </p>
                                </div>
                                {session?.role === "admin" && (
                                    <Link
                                        href="/admin/staff"
                                        onClick={() => setProfileOpen(false)}
                                        className="flex items-center gap-2 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                                    >
                                        <Users2 className="w-4 h-4" /> Manage Staff
                                    </Link>
                                )}
                                <Link
                                    href="/about"
                                    onClick={() => setProfileOpen(false)}
                                    className="flex items-center gap-2 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                    <ShieldCheck className="w-4 h-4" /> About this system
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                >
                                    <LogOut className="w-4 h-4" /> Sign out
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </header>
    );
}
