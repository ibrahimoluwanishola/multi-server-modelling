"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, Clock, AlertTriangle, CheckCircle2, XCircle, Stethoscope, LucideIcon } from "lucide-react";
import { DepartmentWithMetrics, Visit } from "@/types/queue";
import { useSession } from "@/hooks/useSession";
import { useVisitEvents } from "@/hooks/useVisitEvents";

const PRIORITIES: { value: Visit["priority"]; label: string; color: string }[] = [
    { value: "Routine", label: "Routine", color: "bg-slate-100 text-slate-700" },
    { value: "Urgent", label: "Urgent", color: "bg-amber-100 text-amber-700" },
    { value: "Emergency", label: "Emergency", color: "bg-rose-100 text-rose-700" },
];

const STATUS_LABEL: Record<Visit["status"], { label: string; icon: LucideIcon; color: string }> = {
    WAITING: { label: "Waiting", icon: Clock, color: "text-amber-600 bg-amber-50" },
    IN_CONSULTATION: { label: "With doctor", icon: Stethoscope, color: "text-blue-600 bg-blue-50" },
    COMPLETED: { label: "Completed", icon: CheckCircle2, color: "text-green-600 bg-green-50" },
    CANCELLED: { label: "Cancelled", icon: XCircle, color: "text-slate-400 bg-slate-50" },
};

export default function ReceptionPage() {
    const { session } = useSession();
    const [departments, setDepartments] = useState<DepartmentWithMetrics[]>([]);
    const [visits, setVisits] = useState<Visit[]>([]);
    const [form, setForm] = useState({ patientName: "", departmentId: "", reason: "", priority: "Routine" as Visit["priority"] });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const loadData = async () => {
        const [deptRes, visitRes] = await Promise.all([
            fetch("/api/departments"),
            fetch("/api/visits"),
        ]);
        const deptData = await deptRes.json();
        const visitData = await visitRes.json();
        const deptList: DepartmentWithMetrics[] = deptData.departments || [];
        setDepartments(deptList);
        setVisits(visitData.visits || []);
        setForm((f) => ({ ...f, departmentId: f.departmentId || session?.departmentId || deptList[0]?.id || "" }));
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session?.departmentId]);

    useVisitEvents(loadData);

    const activeVisits = useMemo(
        () => visits.filter((v) => v.status === "WAITING" || v.status === "IN_CONSULTATION"),
        [visits]
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        if (!form.patientName.trim() || !form.departmentId || !form.reason.trim()) {
            setError("Patient name, department, and reason for visit are all required.");
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch("/api/visits", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Check-in failed");
            setSuccess(`${form.patientName} checked in and the doctor has been notified.`);
            setForm((f) => ({ ...f, patientName: "", reason: "", priority: "Routine" }));
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Reception — Patient Check-In</h1>
                <p className="text-slate-500 mt-1">
                    Check patients in, capture their reason for visiting once here, and the assigned doctor is notified
                    instantly with everything they need — no re-asking the patient at the consultation.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-100 h-fit space-y-4">
                    <h2 className="font-semibold text-lg flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-blue-500" /> New Check-In
                    </h2>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Patient Name</label>
                        <input
                            value={form.patientName}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setForm({ ...form, patientName: e.target.value })}
                            className="input-field"
                            placeholder="e.g. Amaka Okafor"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                        <select
                            value={form.departmentId}
                            onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                            className="input-field"
                        >
                            {departments.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Reason for Visit / Symptoms</label>
                        <textarea
                            value={form.reason}
                            onChange={(e) => setForm({ ...form, reason: e.target.value })}
                            className="input-field"
                            rows={3}
                            placeholder="e.g. Fever for 3 days, poor appetite, mild cough"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                            The doctor sees this exact text — capture enough detail that they don&apos;t need to ask again.
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Priority</label>
                        <div className="flex gap-2">
                            {PRIORITIES.map((p) => (
                                <button
                                    type="button"
                                    key={p.value}
                                    onClick={() => setForm({ ...form, priority: p.value })}
                                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                        form.priority === p.value ? `${p.color} border-current` : "border-slate-200 text-slate-500"
                                    }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-3 bg-green-50 text-green-700 text-sm rounded-lg flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                            {success}
                        </div>
                    )}

                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {submitting ? "Checking in..." : "Check In Patient"}
                    </motion.button>
                </form>

                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-lg">Live Queue</h2>
                        <span className="text-sm text-slate-500">{activeVisits.length} active</span>
                    </div>
                    <div className="space-y-3">
                        <AnimatePresence initial={false}>
                            {activeVisits.map((visit) => {
                                const status = STATUS_LABEL[visit.status];
                                const StatusIcon = status.icon;
                                return (
                                    <motion.div
                                        key={visit.id}
                                        layout
                                        initial={{ opacity: 0, y: -8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-4 bg-slate-50"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold text-slate-900 truncate">{visit.patientName}</p>
                                                {visit.priority !== "Routine" && (
                                                    <span
                                                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                            visit.priority === "Emergency" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                                                        }`}
                                                    >
                                                        {visit.priority}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-500 truncate">{visit.departmentName} &middot; {visit.reason}</p>
                                        </div>
                                        <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full shrink-0 ${status.color}`}>
                                            <StatusIcon className="w-3.5 h-3.5" />
                                            {status.label}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                        {!activeVisits.length && (
                            <p className="text-slate-400 text-sm text-center py-8">No patients currently waiting or in consultation.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
