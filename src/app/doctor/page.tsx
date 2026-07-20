"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Stethoscope, Clock, User, CheckCircle2, PlayCircle, AlertTriangle, Bell } from "lucide-react";
import { DepartmentWithMetrics, Visit } from "@/types/queue";
import { useSession } from "@/hooks/useSession";
import { useVisitEvents } from "@/hooks/useVisitEvents";

function timeSince(iso: string): string {
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 1) return "just now";
    if (mins === 1) return "1 min ago";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m ago`;
}

export default function DoctorPage() {
    const { session } = useSession();
    const isAdmin = session?.role === "admin";

    const [departments, setDepartments] = useState<DepartmentWithMetrics[]>([]);
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
    const [waiting, setWaiting] = useState<Visit[]>([]);
    const [current, setCurrent] = useState<Visit | null>(null);
    const [completedToday, setCompletedToday] = useState<Visit[]>([]);
    const [notes, setNotes] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const priorityRank: Record<Visit["priority"], number> = { Emergency: 0, Urgent: 1, Routine: 2 };

    // Doctors are locked to their own assigned department. Admins get a
    // free choice of any department, so an admin account is never blocked
    // from covering/overseeing a queue just because it has no department
    // of its own — that's expected for an admin, not a bug, but it
    // shouldn't stop the admin from actually using the page.
    const effectiveDepartmentId = isAdmin ? selectedDepartmentId : session?.departmentId;

    // Load the department list once, for the admin picker.
    useEffect(() => {
        if (!isAdmin) return;
        fetch("/api/departments")
            .then((res) => res.json())
            .then((data) => {
                const list: DepartmentWithMetrics[] = data.departments || [];
                setDepartments(list);
                setSelectedDepartmentId((prev) => prev || list[0]?.id || "");
            });
    }, [isAdmin]);

    const loadData = async () => {
        if (!effectiveDepartmentId || !session) return;
        const res = await fetch(`/api/visits?departmentId=${effectiveDepartmentId}`);
        const data = await res.json();
        const visits: Visit[] = data.visits || [];
        setWaiting(
            visits
                .filter((v) => v.status === "WAITING")
                .sort((a, b) => {
                    const p = priorityRank[a.priority] - priorityRank[b.priority];
                    if (p !== 0) return p;
                    return new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime();
                })
        );
        setCurrent(
            visits.find((v) => v.status === "IN_CONSULTATION" && v.assignedDoctorId === session.userId) || null
        );
        const today = new Date().toISOString().slice(0, 10);
        setCompletedToday(
            visits.filter(
                (v) => v.status === "COMPLETED" && v.assignedDoctorId === session.userId && v.checkedInAt.slice(0, 10) === today
            )
        );
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveDepartmentId]);

    useVisitEvents(loadData);

    const handleStart = async (visitId: string) => {
        setError(null);
        setBusy(true);
        try {
            const res = await fetch(`/api/visits/${visitId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "start" }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Could not start consultation");
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred.");
        } finally {
            setBusy(false);
        }
    };

    const handleComplete = async () => {
        if (!current) return;
        setError(null);
        setBusy(true);
        try {
            const res = await fetch(`/api/visits/${current.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "complete", notes }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Could not complete consultation");
            setNotes("");
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred.");
        } finally {
            setBusy(false);
        }
    };

    // Only a genuine doctor account with no department assigned hits this —
    // an admin always gets the department picker below instead.
    if (session && session.role === "doctor" && !session.departmentId) {
        return (
            <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-100 p-10 text-center text-slate-500">
                <Stethoscope className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                <p className="font-medium text-slate-700">No department is assigned to your account yet.</p>
                <p className="text-sm mt-1">Ask an admin to assign you to a department on the Staff Management page.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">
                        {isAdmin ? "Doctor Queue (Admin Oversight)" : session ? `${session.name}'s Queue` : "Doctor Dashboard"}
                    </h1>
                    <p className="text-slate-500 mt-1">
                        {isAdmin
                            ? "As admin, you can view and act on any department's queue — pick one below."
                            : "Patients checked in by Reception appear here instantly with everything they told the front desk — no need to ask again."}
                    </p>
                </div>
                {isAdmin && (
                    <select
                        value={selectedDepartmentId}
                        onChange={(e) => setSelectedDepartmentId(e.target.value)}
                        className="input-field sm:w-64"
                    >
                        {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.name}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    {error}
                </div>
            )}

            {current ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-blue-600 text-white rounded-2xl p-6"
                >
                    <div className="flex items-center gap-2 text-blue-200 text-sm font-medium mb-3">
                        <Stethoscope className="w-4 h-4" /> Currently in consultation
                    </div>
                    <h2 className="text-2xl font-bold">{current.patientName}</h2>
                    <p className="text-blue-100 mt-2">{current.reason}</p>
                    <div className="flex items-center gap-4 mt-4 text-sm text-blue-200">
                        <span>Checked in {timeSince(current.checkedInAt)}</span>
                        <span>&middot;</span>
                        <span>Priority: {current.priority}</span>
                        <span>&middot;</span>
                        <span>By {current.checkedInBy}</span>
                    </div>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Consultation notes (optional)..."
                        className="w-full mt-4 p-3 rounded-lg bg-white/10 border border-white/20 placeholder:text-blue-200 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/40"
                        rows={2}
                    />
                    <button
                        onClick={handleComplete}
                        disabled={busy}
                        className="mt-4 flex items-center gap-2 bg-white text-blue-700 font-semibold px-5 py-2.5 rounded-full hover:bg-blue-50 transition disabled:opacity-60"
                    >
                        <CheckCircle2 className="w-4 h-4" /> Complete Consultation
                    </button>
                </motion.div>
            ) : (
                <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
                    No patient currently in consultation. Start the next one from the queue below.
                </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-lg flex items-center gap-2">
                        <Bell className="w-5 h-5 text-amber-500" /> Waiting Queue
                    </h2>
                    <span className="text-sm text-slate-500">{waiting.length} waiting</span>
                </div>
                <div className="space-y-3">
                    <AnimatePresence initial={false}>
                        {waiting.map((visit, i) => (
                            <motion.div
                                key={visit.id}
                                layout
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-4 bg-slate-50"
                            >
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                                        <User className="w-4 h-4" />
                                    </div>
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
                                        <p className="text-sm text-slate-600 mt-0.5">{visit.reason}</p>
                                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> {timeSince(visit.checkedInAt)} &middot; checked in by {visit.checkedInBy}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleStart(visit.id)}
                                    disabled={busy || !!current}
                                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-full shrink-0 disabled:opacity-40 transition"
                                >
                                    <PlayCircle className="w-4 h-4" /> {i === 0 && !current ? "Start" : "Queued"}
                                </button>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {!waiting.length && <p className="text-slate-400 text-sm text-center py-6">No patients waiting right now.</p>}
                </div>
            </div>

            {completedToday.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                    <h2 className="font-semibold text-lg mb-4">Completed Today ({completedToday.length})</h2>
                    <div className="space-y-2">
                        {completedToday.map((v) => (
                            <div key={v.id} className="flex items-center justify-between text-sm text-slate-600 py-2 border-b border-slate-50 last:border-0">
                                <span className="font-medium text-slate-800">{v.patientName}</span>
                                <span className="text-slate-400">{v.reason}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
