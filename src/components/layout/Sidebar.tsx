"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard,
    Building2,
    PlayCircle,
    Target,
    FileBarChart,
    Sparkles,
    FlaskConical,
    Info,
    X,
    LogOut,
    LogIn,
    ChevronLeft,
    ChevronRight,
    UserPlus,
    Stethoscope,
    Users2,
    LucideIcon,
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useSession } from "@/hooks/useSession";

type Role = "admin" | "doctor" | "receptionist";

const navItems: { name: string; href: string; icon: LucideIcon; roles: Role[]; public?: boolean }[] = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "doctor", "receptionist"] },
    { name: "Reception", href: "/reception", icon: UserPlus, roles: ["admin", "receptionist"] },
    { name: "My Queue", href: "/doctor", icon: Stethoscope, roles: ["admin", "doctor"] },
    { name: "Departments", href: "/departments", icon: Building2, roles: ["admin"] },
    { name: "Staff Management", href: "/admin/staff", icon: Users2, roles: ["admin"] },
    { name: "Simulation", href: "/simulation", icon: PlayCircle, roles: ["admin", "doctor", "receptionist"], public: true },
    { name: "Optimization", href: "/optimization", icon: Target, roles: ["admin", "doctor", "receptionist"], public: true },
    { name: "ML Forecast", href: "/forecast", icon: Sparkles, roles: ["admin", "doctor", "receptionist"], public: true },
    { name: "Validation", href: "/validation", icon: FlaskConical, roles: ["admin", "doctor", "receptionist"], public: true },
    { name: "Reports", href: "/reports", icon: FileBarChart, roles: ["admin", "doctor", "receptionist"] },
    { name: "About", href: "/about", icon: Info, roles: ["admin", "doctor", "receptionist"], public: true },
];

const ROLE_LABEL: Record<Role, string> = {
    admin: "Administrator",
    doctor: "Doctor",
    receptionist: "Receptionist",
};

interface SidebarProps {
    isOpen: boolean;
    collapsed: boolean;
    onClose: () => void;
    onToggleCollapse: () => void;
}

export function Sidebar({ isOpen, collapsed, onClose, onToggleCollapse }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { session, loading } = useSession();

    const visibleItems = navItems.filter((item) =>
        session ? item.roles.includes(session.role) : !loading && item.public
    );

    const initials = session?.name
        ? session.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
        : "?";

    const handleLogout = async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
    };

    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={clsx(
                    "fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            <aside
                className={twMerge(
                    "fixed lg:static inset-y-0 left-0 bg-slate-900 text-white z-50 border-r border-slate-800 flex flex-col h-full transform transition-all duration-300 ease-in-out",
                    isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
                    collapsed ? "lg:w-20" : "lg:w-64",
                    !collapsed && "w-64"
                )}
            >
                <div className={clsx("px-4 py-6 flex items-center gap-3", collapsed ? "justify-center" : "justify-between")}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-500 flex items-center justify-center text-white font-bold">
                            M
                        </div>
                        {!collapsed && (
                            <div>
                                <h1 className="text-xl font-bold bg-linear-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
                                    MediQueue Optima
                                </h1>
                                <p className="text-xs text-slate-400 mt-1">Hospital Efficiency Engine</p>
                            </div>
                        )}
                    </div>
                    {!collapsed && (
                        <button
                            onClick={onClose}
                            className="lg:hidden p-2 text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                    {visibleItems.map((item) => {
                        const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => onClose()}
                                title={item.name}
                                className={twMerge(
                                    "flex items-center transition-all group relative duration-200",
                                    collapsed ? "justify-center px-0 py-4" : "px-4 py-3",
                                    isActive
                                        ? "bg-blue-600 text-white"
                                        : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                                )}
                            >
                                <Icon className={clsx("w-5 h-5 transition-colors", isActive ? "text-white" : "text-slate-400 group-hover:text-white")} />
                                {!collapsed && <span className="font-medium text-sm ml-3">{item.name}</span>}
                                {isActive && !collapsed && (
                                    <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                <div className={clsx("border-t border-slate-800 p-4", collapsed ? "flex justify-center" : "")}>
                    <button
                        onClick={onToggleCollapse}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-slate-200 flex items-center justify-center gap-2 hover:bg-slate-700 transition"
                    >
                        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                        {!collapsed && <span className="text-sm">Collapse</span>}
                    </button>
                </div>

                {session && (
                    <div className="p-4 border-t border-slate-800">
                        <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-800/50">
                            <div className="w-9 h-9 rounded-full bg-linear-to-br from-blue-500 to-teal-500 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-white uppercase tracking-tighter">{initials}</span>
                            </div>
                            {!collapsed && (
                                <>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate text-slate-100">{session.name}</p>
                                        <p className="text-[10px] text-slate-500 truncate font-medium">{ROLE_LABEL[session.role]}</p>
                                    </div>
                                    <button
                                        onClick={handleLogout}
                                        title="Sign out"
                                        className="p-1.5 text-slate-500 hover:text-white transition-colors"
                                    >
                                        <LogOut className="w-4 h-4" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {!session && !loading && (
                    <div className="p-4 border-t border-slate-800">
                        <Link
                            href="/login"
                            onClick={() => onClose()}
                            className={clsx(
                                "flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 transition-colors text-white font-medium",
                                collapsed ? "justify-center p-2.5" : "px-4 py-2.5"
                            )}
                            title="Sign in"
                        >
                            <LogIn className="w-4 h-4 shrink-0" />
                            {!collapsed && <span className="text-sm">Staff sign in</span>}
                        </Link>
                        {!collapsed && (
                            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                                You&apos;re viewing the public analytical toolkit. Sign in for Reception, Doctor, and
                                Admin tools.
                            </p>
                        )}
                    </div>
                )}
            </aside>
        </>
    );
}
