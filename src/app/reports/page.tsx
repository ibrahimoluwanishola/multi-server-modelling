"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Download, Printer, Filter, Activity, Inbox, ArrowRight } from "lucide-react";
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { HospitalReport } from "@/types/queue";
import { useVisitEvents } from "@/hooks/useVisitEvents";

function downloadCsv(reports: HospitalReport[]) {
    const header = [
        "date",
        "department",
        "consultation_count",
        "avg_resolution_time_minutes",
        "avg_wait_time_minutes",
        "utilization_percent",
    ];
    const rows = reports.map((r) => [
        r.date,
        r.departmentName,
        r.consultationCount,
        r.avgResolutionTimeMinutes,
        r.avgWaitTimeMinutes,
        r.utilization,
    ]);
    const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mediqueue-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

export default function ReportsPage() {
    const [reports, setReports] = useState<HospitalReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [departmentFilter, setDepartmentFilter] = useState<string>("all");

    const loadData = async () => {
        const res = await fetch("/api/reports");
        const data = await res.json();
        setReports(data.reports || []);
        setLoading(false);
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadData();
    }, []);

    useVisitEvents(loadData);

    const departmentNames = useMemo(
        () => Array.from(new Set(reports.map((r) => r.departmentName))).sort(),
        [reports]
    );

    const filteredReports = useMemo(
        () => (departmentFilter === "all" ? reports : reports.filter((r) => r.departmentName === departmentFilter)),
        [reports, departmentFilter]
    );

    const totalConsultations = filteredReports.reduce((sum, r) => sum + r.consultationCount, 0);
    const avgResolution = filteredReports.length
        ? filteredReports.reduce((sum, r) => sum + r.avgResolutionTimeMinutes, 0) / filteredReports.length
        : 0;

    const chartData = useMemo(() => {
        const byDate = new Map<string, { resolution: number; count: number }>();
        filteredReports.forEach((r) => {
            const entry = byDate.get(r.date) || { resolution: 0, count: 0 };
            entry.resolution += r.avgResolutionTimeMinutes;
            entry.count += 1;
            byDate.set(r.date, entry);
        });
        return [...byDate.entries()]
            .sort((a, b) => (a[0] < b[0] ? -1 : 1))
            .slice(-14)
            .map(([date, v]) => ({
                name: new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
                resolution: Number((v.resolution / v.count).toFixed(1)),
            }));
    }, [filteredReports]);

    const hasAnyData = reports.length > 0;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Reports &amp; Analytics</h1>
                    <p className="text-slate-500 mt-1">
                        Computed entirely from real, completed patient visits logged through Reception — no simulated
                        or seeded figures.
                    </p>
                </div>
                {hasAnyData && (
                    <div className="flex items-center gap-3 flex-wrap">
                        <select
                            value={departmentFilter}
                            onChange={(e) => setDepartmentFilter(e.target.value)}
                            className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-medium text-sm bg-white"
                        >
                            <option value="all">All departments</option>
                            {departmentNames.map((name) => (
                                <option key={name} value={name}>
                                    {name}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={() => downloadCsv(filteredReports)}
                            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-medium hover:bg-slate-50 transition-colors text-sm"
                        >
                            <Download className="w-4 h-4" />
                            Export CSV
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-medium hover:bg-slate-50 transition-colors text-sm"
                        >
                            <Printer className="w-4 h-4" />
                            Print / Save as PDF
                        </button>
                    </div>
                )}
            </div>

            {!hasAnyData && !loading && (
                <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center text-slate-500">
                    <Inbox className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p className="font-semibold text-slate-700 text-lg">No reports yet</p>
                    <p className="text-sm mt-2 max-w-md mx-auto">
                        Reports are generated automatically as patients are checked in and seen. There is no seeded or
                        simulated history in this system — check a patient in and complete a consultation to see your
                        first real report appear here.
                    </p>
                    <Link
                        href="/reception"
                        className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 transition"
                    >
                        Go to Reception <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            )}

            {hasAnyData && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-2xl border border-slate-100">
                                <h3 className="text-slate-500 text-sm font-medium uppercase tracking-wider">Total Consultations</h3>
                                <p className="mt-4 text-3xl font-bold text-slate-900">{totalConsultations.toLocaleString()}</p>
                                <p className="mt-1 text-xs text-slate-400 font-medium">Sum across the visible report window.</p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-slate-100">
                                <h3 className="text-slate-500 text-sm font-medium uppercase tracking-wider">Avg Resolution Time</h3>
                                <p className="mt-4 text-3xl font-bold text-slate-900">{avgResolution.toFixed(1)}m</p>
                                <p className="mt-1 text-xs text-slate-400 font-medium">Real check-in-to-completion time, averaged.</p>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-slate-100">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">Resolution Trend</h2>
                                    <p className="text-slate-500 text-sm">Real average time-to-completion per day.</p>
                                </div>
                                <Filter className="w-4 h-4 text-slate-400 no-print" />
                            </div>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorResolution" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.1} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#cbd5e1" }} />
                                        <Area type="monotone" dataKey="resolution" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorResolution)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 h-full">
                            <h2 className="text-lg font-bold text-slate-900 mb-6">Daily Reports</h2>
                            <div className="space-y-3 max-h-[520px] overflow-y-auto">
                                {filteredReports.slice(0, 30).map((report) => (
                                    <div key={report.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-semibold text-slate-900 truncate">{report.departmentName}</h4>
                                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                                                <span>{report.date}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-200" />
                                                <span>{report.consultationCount} seen</span>
                                            </div>
                                        </div>
                                        <div className="text-right text-slate-500 text-xs">
                                            <div>{report.avgWaitTimeMinutes.toFixed(1)}m wait</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-linear-to-br from-indigo-600 to-blue-700 p-6 rounded-2xl text-white no-print">
                            <Activity className="w-10 h-10 mb-4 text-indigo-200 opacity-70" />
                            <h3 className="text-lg font-bold leading-tight">Where this data comes from</h3>
                            <p className="text-indigo-100 text-sm mt-2 opacity-90">
                                Every figure above is computed from real check-in and completion timestamps recorded by
                                Reception and Doctor accounts. There is no synthetic or seeded data anywhere in this
                                report.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
