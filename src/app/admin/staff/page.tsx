"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { UserPlus, Trash2, ShieldCheck, Stethoscope, ClipboardList, AlertTriangle, X, LucideIcon } from "lucide-react";
import { DepartmentWithMetrics, PublicStaffUser } from "@/types/queue";

const ROLE_META: Record<PublicStaffUser["role"], { label: string; icon: LucideIcon; color: string }> = {
    admin: { label: "Admin", icon: ShieldCheck, color: "bg-violet-100 text-violet-700" },
    doctor: { label: "Doctor", icon: Stethoscope, color: "bg-blue-100 text-blue-700" },
    receptionist: { label: "Receptionist", icon: ClipboardList, color: "bg-teal-100 text-teal-700" },
};

const emptyForm = { name: "", username: "", password: "", role: "doctor" as PublicStaffUser["role"], departmentId: "" };

export default function StaffManagementPage() {
    const [staff, setStaff] = useState<PublicStaffUser[]>([]);
    const [departments, setDepartments] = useState<DepartmentWithMetrics[]>([]);
    const [form, setForm] = useState(emptyForm);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        const [staffRes, deptRes] = await Promise.all([fetch("/api/staff"), fetch("/api/departments")]);
        const staffData = await staffRes.json();
        const deptData = await deptRes.json();
        setStaff(staffData.staff || []);
        setDepartments(deptData.departments || []);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!form.name.trim() || !form.username.trim() || !form.password.trim()) {
            setError("Name, username, and password are all required.");
            return;
        }
        if (form.password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }
        if (form.role !== "admin" && !form.departmentId) {
            setError("Please assign a department for this staff member.");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/staff", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Could not create staff account");
            setForm(emptyForm);
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred.");
        } finally {
            setSaving(false);
        }
    };

    const [deleteError, setDeleteError] = useState<string | null>(null);

    const handleDelete = async (id: string) => {
        setDeleteError(null);
        const res = await fetch(`/api/staff/${id}`, { method: "DELETE" });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setDeleteError(data.error || "Could not delete this staff account.");
            return;
        }
        setStaff((prev) => prev.filter((s) => s.id !== id));
    };

    const handleReassign = async (id: string, departmentId: string) => {
        const res = await fetch(`/api/staff/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ departmentId }),
        });
        if (res.ok) {
            const updated = await res.json();
            setStaff((prev) => prev.map((s) => (s.id === id ? updated : s)));
        }
    };

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Staff Management</h1>
                <p className="text-slate-500 mt-1">Create and manage doctor and receptionist accounts, each assigned to a department.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-100 h-fit space-y-4">
                    <h2 className="font-semibold text-lg flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-blue-500" /> New Staff Account
                    </h2>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                        <input
                            value={form.name}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="input-field"
                            placeholder="e.g. Dr. Ifeoma Nwosu"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                        <input
                            value={form.username}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                            className="input-field"
                            placeholder="e.g. dr.nwosu"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Temporary Password</label>
                        <input
                            type="password"
                            value={form.password}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            className="input-field"
                            placeholder="At least 6 characters"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                        <select
                            value={form.role}
                            onChange={(e) => setForm({ ...form, role: e.target.value as PublicStaffUser["role"] })}
                            className="input-field"
                        >
                            <option value="doctor">Doctor</option>
                            <option value="receptionist">Receptionist</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    {form.role !== "admin" && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                            <select
                                value={form.departmentId}
                                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                                className="input-field"
                            >
                                <option value="">Select a department...</option>
                                {departments.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg font-semibold disabled:opacity-60"
                    >
                        {saving ? "Creating..." : "Create Account"}
                    </button>
                </form>

                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 overflow-hidden">
                    {deleteError && (
                        <div className="m-4 mb-0 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-start justify-between gap-3">
                            <span>{deleteError}</span>
                            <button onClick={() => setDeleteError(null)} className="text-red-400 hover:text-red-600 shrink-0">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    <div className="p-6 border-b border-slate-100">
                        <h2 className="font-semibold text-lg">Staff Directory ({staff.length})</h2>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {staff.map((s, i) => {
                            const meta = ROLE_META[s.role];
                            const Icon = meta.icon;
                            return (
                                <motion.div
                                    key={s.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: i * 0.03 }}
                                    className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${meta.color}`}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-medium text-slate-900 truncate">{s.name}</p>
                                            <p className="text-xs text-slate-500 truncate">@{s.username}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        {s.role !== "admin" && (
                                            <select
                                                value={s.departmentId || ""}
                                                onChange={(e) => handleReassign(s.id, e.target.value)}
                                                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 bg-white"
                                                title="Reassign department"
                                            >
                                                <option value="">Unassigned</option>
                                                {departments.map((d) => (
                                                    <option key={d.id} value={d.id}>
                                                        {d.name}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${meta.color}`}>{meta.label}</span>
                                        {s.username !== "admin" && (
                                            <button
                                                onClick={() => handleDelete(s.id)}
                                                className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                        {!staff.length && !loading && (
                            <p className="p-6 text-center text-slate-400 text-sm">No staff accounts yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
