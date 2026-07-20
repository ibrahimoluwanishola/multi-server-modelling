"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Users, Clock, Activity, Search, Plus, X, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";
import { DepartmentWithMetrics } from "@/types/queue";
import { NumberField } from "@/components/ui/NumberField";

const STATUS_COLOR: Record<string, string> = {
    Normal: "#3b82f6",
    Warning: "#f59e0b",
    "High Load": "#f43f5e",
    Critical: "#7f1d1d",
};

const emptyForm = { name: "", category: "General", description: "", lambda: 5, mu: 3, c: 1, nurseCount: 2 };

export default function DepartmentsPage() {
    const [departments, setDepartments] = useState<DepartmentWithMetrics[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadDepartments = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/departments");
            const data = await res.json();
            setDepartments(data.departments || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDepartments();
    }, []);

    const filtered = useMemo(
        () => departments.filter((d) => d.name.toLowerCase().includes(query.toLowerCase())),
        [departments, query]
    );

    const totalStaff = departments.reduce((sum, d) => sum + d.c + d.nurseCount, 0);
    const avgWaitMinutes = departments.length
        ? departments.reduce((sum, d) => sum + (d.metrics.stable ? d.metrics.Wq * 60 : 0), 0) / departments.length
        : 0;
    const avgUtilization = departments.length
        ? (departments.reduce((sum, d) => sum + Math.min(d.metrics.rho, 1), 0) / departments.length) * 100
        : 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (form.mu <= 0 || form.c < 1 || form.lambda < 0) {
            setError("mu must be > 0, c must be >= 1, lambda must be >= 0.");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/departments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to create department");
            setForm(emptyForm);
            setShowForm(false);
            await loadDepartments();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred.");
        } finally {
            setSaving(false);
        }
    };

    const [deleteError, setDeleteError] = useState<string | null>(null);

    const handleDelete = async (id: string) => {
        setDeleteError(null);
        const res = await fetch(`/api/departments/${id}`, { method: "DELETE" });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setDeleteError(data.error || "Could not delete this department.");
            return;
        }
        setDepartments((prev) => prev.filter((d) => d.id !== id));
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Departments</h1>
                    <p className="text-slate-500 mt-1">
                        Each department is modelled as its own independent M/M/c queue (λ, μ, c). Metrics update live from
                        the analytical engine in <code>src/lib/mmc.ts</code>.
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Add Department
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: "Total Departments", value: String(departments.length), icon: Building2, color: "bg-blue-500" },
                    { label: "Doctors + Nurses", value: String(totalStaff), icon: Users, color: "bg-teal-500" },
                    { label: "Avg Wait Time (Wq)", value: `${avgWaitMinutes.toFixed(1)}m`, icon: Clock, color: "bg-amber-500" },
                    { label: "Avg Utilization (ρ)", value: `${avgUtilization.toFixed(0)}%`, icon: Activity, color: "bg-indigo-500" },
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`${stat.color} p-2.5 rounded-xl text-white`}>
                                <stat.icon className="w-5 h-5" />
                            </div>
                        </div>
                        <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                        <h3 className="text-2xl font-bold text-slate-900 mt-1">{loading ? "…" : stat.value}</h3>
                    </div>
                ))}
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Server Utilization by Department (ρ)</h2>
                        <p className="text-sm text-slate-500">Traffic intensity ρ = λ / (c·μ). ρ ≥ 0.85 flags high load.</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                        <span className="w-3 h-3 rounded-full" style={{ background: STATUS_COLOR.Normal }} /> Normal
                        <span className="w-3 h-3 rounded-full ml-2" style={{ background: STATUS_COLOR.Warning }} /> Warning
                        <span className="w-3 h-3 rounded-full ml-2" style={{ background: STATUS_COLOR["High Load"] }} /> High Load
                    </div>
                </div>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={departments} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dx={-10} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                            <RechartsTooltip
                                formatter={(value?: number) => [`${((value ?? 0) * 100).toFixed(1)}%`, "Utilization"]}
                                cursor={{ fill: "#f8fafc" }}
                                contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0" }}
                            />
                            <Bar dataKey={(d: DepartmentWithMetrics) => d.metrics.rho} name="Utilization" radius={[4, 4, 0, 0]}>
                                {departments.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={STATUS_COLOR[entry.status] || STATUS_COLOR.Normal} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden text-slate-900">
                {deleteError && (
                    <div className="m-4 mb-0 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-start justify-between gap-3">
                        <span>{deleteError}</span>
                        <button onClick={() => setDeleteError(null)} className="text-red-400 hover:text-red-600 shrink-0">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h2 className="text-lg font-bold">Department List</h2>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Filter departments..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 transition-all text-slate-900"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                                <th className="px-6 py-4">Department</th>
                                <th className="px-6 py-4">λ (arr/hr)</th>
                                <th className="px-6 py-4">μ (svc/hr)</th>
                                <th className="px-6 py-4">Doctors (c)</th>
                                <th className="px-6 py-4">Avg Wait (Wq)</th>
                                <th className="px-6 py-4">Utilization</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map((dept) => (
                                <tr key={dept.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                                <Building2 className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="font-medium">{dept.name}</div>
                                                <div className="text-xs text-slate-400">{dept.category}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium">{dept.lambda}</td>
                                    <td className="px-6 py-4 font-medium">{dept.mu}</td>
                                    <td className="px-6 py-4 font-medium">{dept.c}</td>
                                    <td className="px-6 py-4">
                                        {dept.metrics.stable ? `${(dept.metrics.Wq * 60).toFixed(1)}m` : (
                                            <span className="text-red-600 font-semibold">Unstable</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full"
                                                    style={{
                                                        width: `${Math.min(dept.metrics.rho, 1) * 100}%`,
                                                        background: STATUS_COLOR[dept.status] || STATUS_COLOR.Normal,
                                                    }}
                                                />
                                            </div>
                                            <span className="text-sm font-medium">{(Math.min(dept.metrics.rho, 9.99) * 100).toFixed(0)}%</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDelete(dept.id)}
                                            className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                            title="Remove department"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {!filtered.length && !loading && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                                        No departments match &quot;{query}&quot;.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 relative">
                        <button
                            onClick={() => setShowForm(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Add Department</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                                <input
                                    required
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="input-field"
                                    placeholder="e.g. Physiotherapy Unit"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                                <input
                                    value={form.category}
                                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                                    className="input-field"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <NumberField label="λ / hr" value={form.lambda} onChange={(v) => setForm({ ...form, lambda: v })} step={0.1} />
                                <NumberField label="μ / hr" value={form.mu} onChange={(v) => setForm({ ...form, mu: v })} step={0.1} />
                                <NumberField label="Doctors (c)" value={form.c} onChange={(v) => setForm({ ...form, c: v })} min={1} />
                            </div>
                            <NumberField label="Nurses" value={form.nurseCount} onChange={(v) => setForm({ ...form, nurseCount: v })} min={0} />
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    className="input-field"
                                    rows={2}
                                />
                            </div>
                            {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}
                            <button
                                type="submit"
                                disabled={saving}
                                className="btn-primary w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg"
                            >
                                {saving ? "Saving..." : "Add Department"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
