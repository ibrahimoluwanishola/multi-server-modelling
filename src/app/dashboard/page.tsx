"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Building2, Users, Clock, Activity, ArrowRight, Inbox } from "lucide-react";
import Link from "next/link";
import { DepartmentWithMetrics } from "@/types/queue";
import { HOSPITAL_PROFILE } from "@/lib/hospital-data";
import { useSession } from "@/hooks/useSession";
import { useVisitEvents } from "@/hooks/useVisitEvents";

interface TodaySummary {
    totalCheckedInToday: number;
    waitingNow: number;
    inConsultationNow: number;
    completedToday: number;
    avgWaitMinutesToday: number;
    hasData: boolean;
}

export default function DashboardPage() {
    const { session } = useSession();
    const [departments, setDepartments] = useState<DepartmentWithMetrics[]>([]);
    const [summary, setSummary] = useState<TodaySummary | null>(null);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        const [deptRes, reportRes] = await Promise.all([fetch("/api/departments"), fetch("/api/reports")]);
        const deptData = await deptRes.json();
        const reportData = await reportRes.json();
        setDepartments(deptData.departments || []);
        setSummary(reportData.todaySummary || null);
        setLoading(false);
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadData();
    }, []);

    useVisitEvents(loadData);

    const totalDoctors = departments.reduce((sum, dept) => sum + dept.c, 0);
    const totalNurses = departments.reduce((sum, dept) => sum + dept.nurseCount, 0);
    const criticalCount = departments.filter((d) => d.status === "High Load" || d.status === "Critical").length;

    return (
        <div className="space-y-6">
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
            >
                <div>
                    <h2 className="text-3xl font-bold text-slate-900">
                        {session ? `Welcome back, ${session.name}` : "Hospital Overview"}
                    </h2>
                    <p className="text-slate-500 mt-1 max-w-2xl">
                        {HOSPITAL_PROFILE.name}, {HOSPITAL_PROFILE.location} — live department capacity and real patient
                        flow, sourced entirely from actual check-ins recorded in this system.
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Link
                        href="/reception"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 transition"
                    >
                        Check in a patient <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </motion.div>

            {criticalCount > 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-4 text-sm font-medium"
                >
                    {criticalCount} department{criticalCount > 1 ? "s are" : " is"} running at high theoretical
                    utilization (ρ ≥ 0.85) based on configured λ/μ/c. Visit Optimization to find the minimum staffing
                    needed.
                </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: "Checked In Today", value: summary?.totalCheckedInToday ?? 0, icon: Building2, color: "bg-blue-500" },
                    { label: "Waiting Right Now", value: summary?.waitingNow ?? 0, icon: Users, color: "bg-amber-500" },
                    { label: "In Consultation", value: summary?.inConsultationNow ?? 0, icon: Activity, color: "bg-indigo-500" },
                    {
                        label: "Avg Wait Today",
                        value: summary?.hasData ? `${summary.avgWaitMinutesToday}m` : "—",
                        icon: Clock,
                        color: "bg-teal-500",
                    },
                ].map((stat, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-white p-6 rounded-3xl border border-slate-100"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className={`${stat.color} p-2.5 rounded-xl text-white`}>
                                <stat.icon className="w-5 h-5" />
                            </div>
                        </div>
                        <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                        <p className="text-3xl font-bold text-slate-900 mt-1">{loading ? "…" : stat.value}</p>
                    </motion.div>
                ))}
            </div>

            {!summary?.hasData && !loading && (
                <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-10 text-center text-slate-500">
                    <Inbox className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="font-medium text-slate-700">No patients have been checked in today yet.</p>
                    <p className="text-sm mt-1">
                        These figures are real operational data — they populate as receptionists check patients in on
                        the{" "}
                        <Link href="/reception" className="text-blue-600 underline underline-offset-2">
                            Reception
                        </Link>{" "}
                        page. Nothing here is simulated or pre-filled.
                    </p>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-100">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <p className="text-sm uppercase tracking-wider text-slate-400 font-semibold">Capacity</p>
                            <h3 className="text-lg font-semibold text-slate-900">Departments &amp; Staffing</h3>
                        </div>
                        <span className="text-sm text-slate-500">
                            {totalDoctors} doctors &middot; {totalNurses} nurses
                        </span>
                    </div>
                    <div className="space-y-3">
                        {departments.map((dept, i) => (
                            <motion.div
                                key={dept.id}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.04 }}
                                className="flex items-center justify-between rounded-2xl border border-slate-100 p-4 bg-slate-50"
                            >
                                <div>
                                    <p className="font-semibold text-slate-900">{dept.name}</p>
                                    <p className="text-sm text-slate-500">{dept.c} doctors &middot; {dept.nurseCount} nurses</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-semibold text-slate-900">
                                        {dept.metrics.stable ? `${(dept.metrics.Wq * 60).toFixed(1)}m planning est.` : "Unstable"}
                                    </p>
                                    <p className="text-xs text-slate-500">{dept.status}</p>
                                </div>
                            </motion.div>
                        ))}
                        {!departments.length && !loading && (
                            <p className="text-slate-500 text-sm">No departments configured yet.</p>
                        )}
                    </div>
                </div>

                <div className="bg-linear-to-br from-indigo-600 to-blue-700 p-6 rounded-3xl text-white flex flex-col">
                    <p className="text-sm uppercase tracking-[0.2em] text-indigo-200">Case study</p>
                    <h3 className="text-xl font-semibold mt-1">{HOSPITAL_PROFILE.shortName}</h3>
                    <p className="text-sm text-indigo-100 leading-relaxed mt-3 flex-1">
                        {HOSPITAL_PROFILE.notes} Founded {HOSPITAL_PROFILE.founded}, {HOSPITAL_PROFILE.beds} beds,
                        owned by the {HOSPITAL_PROFILE.ownership}.
                    </p>
                    <Link
                        href="/about"
                        className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-white bg-white/10 hover:bg-white/20 transition-colors px-4 py-2 rounded-full w-fit"
                    >
                        Read the full methodology <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
