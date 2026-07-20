"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Activity, Lock, User, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";

const DEMO_ACCOUNTS = [
    { role: "Admin", username: "admin", password: "admin123" },
    { role: "Doctor", username: "dr.adeyemi", password: "doctor123" },
    { role: "Receptionist", username: "reception1", password: "reception123" },
];

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginForm />
        </Suspense>
    );
}

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Login failed");

            // `next` comes straight from the URL query string, which is
            // attacker-controllable (anyone can link to /login?next=...) —
            // not just the login redirect proxy.ts itself generates. Only
            // honor it if it's a genuine internal relative path, never an
            // absolute or protocol-relative URL, so a crafted link can't
            // redirect a freshly-authenticated user off the site.
            const next = searchParams.get("next");
            const isSafeInternalPath = !!next && next.startsWith("/") && !next.startsWith("//");
            if (isSafeInternalPath) {
                router.push(next);
            } else if (data.role === "doctor") {
                router.push("/doctor");
            } else if (data.role === "receptionist") {
                router.push("/reception");
            } else {
                router.push("/dashboard");
            }
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed.");
        } finally {
            setLoading(false);
        }
    };

    const fillDemo = (u: string, p: string) => {
        setUsername(u);
        setPassword(p);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="relative w-full max-w-md bg-slate-900/80 backdrop-blur border border-slate-800 rounded-3xl p-8 shadow-2xl"
            >
                <Link href="/" className="flex items-center gap-2 mb-8 text-slate-300 hover:text-white transition-colors w-fit">
                    <Activity className="w-6 h-6 text-blue-400" />
                    <span className="font-semibold">MediQueue Optima</span>
                </Link>

                <h1 className="text-2xl font-bold mb-1">Sign in to your account</h1>
                <p className="text-slate-400 text-sm mb-8">Massey Street Children&apos;s Hospital &middot; Staff Portal</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Username</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                required
                                autoFocus
                                value={username}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-800/70 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g. admin"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                required
                                type="password"
                                value={password}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-800/70 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            {error}
                        </div>
                    )}

                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {loading ? "Signing in..." : "Sign in"}
                        {!loading && <ArrowRight className="w-4 h-4" />}
                    </motion.button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-800">
                    <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">Demo accounts (click to fill)</p>
                    <div className="space-y-2">
                        {DEMO_ACCOUNTS.map((acc) => (
                            <button
                                key={acc.username}
                                onClick={() => fillDemo(acc.username, acc.password)}
                                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors text-left"
                            >
                                <span className="text-sm font-medium text-slate-200">{acc.role}</span>
                                <span className="text-xs text-slate-500 font-mono">{acc.username}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
