"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, FlaskConical, RefreshCw, TrendingUp } from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    Legend,
    ReferenceLine,
} from "recharts";
import { ValidationSummary } from "@/lib/validation";

export default function ValidationPage() {
    const [summary, setSummary] = useState<ValidationSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const runSweep = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/validation");
            if (!res.ok) throw new Error("Validation sweep failed.");
            const data = await res.json();
            setSummary(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        runSweep();
    }, []);

    const chartData = summary?.cases.map((c) => ({
        name: `c=${c.c}, ρ≈${c.theoretical.rho.toFixed(2)}`,
        "Wq error %": Number(c.percentError.Wq.toFixed(2)),
        "Lq error %": Number(c.percentError.Lq.toFixed(2)),
    }));

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                        <FlaskConical className="w-7 h-7 text-emerald-500" /> Simulation Accuracy Validation
                    </h1>
                    <p className="text-slate-500 mt-1 max-w-3xl">
                        Runs the discrete-event simulation against 10 parameter configurations spanning light,
                        moderate, heavy, and near-critical utilization at c = 1, 2, 3, and 4 servers, and compares
                        every result to the exact analytical M/M/c prediction. This is the system&apos;s accuracy
                        validation objective, demonstrated directly rather than checked by hand on a single case.
                    </p>
                </div>
                <button
                    onClick={runSweep}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-sm font-medium transition disabled:opacity-60 shrink-0"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    {loading ? "Running sweep..." : "Re-run sweep"}
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>
            )}

            {summary && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="bg-white p-5 rounded-2xl border border-slate-100">
                            <p className="text-xs uppercase text-slate-400 font-medium">Configurations Tested</p>
                            <p className="text-2xl font-bold text-slate-900 mt-1">{summary.totalCases}</p>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-100">
                            <p className="text-xs uppercase text-slate-400 font-medium">Within {summary.toleranceThresholdPercent}% Tolerance</p>
                            <p className="text-2xl font-bold text-slate-900 mt-1">
                                {summary.casesWithinTolerance} / {summary.totalCases}
                            </p>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-100">
                            <p className="text-xs uppercase text-slate-400 font-medium">Mean Abs. % Error</p>
                            <p className="text-2xl font-bold text-slate-900 mt-1">{summary.meanAbsolutePercentError}%</p>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-100">
                            <p className="text-xs uppercase text-slate-400 font-medium">Max Abs. % Error</p>
                            <p className="text-2xl font-bold text-slate-900 mt-1">{summary.maxAbsolutePercentError}%</p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-5 h-5 text-emerald-600" />
                            <h2 className="text-lg font-bold text-slate-900">Percent Error by Configuration</h2>
                        </div>
                        <p className="text-slate-500 text-sm mb-6">
                            {summary.replicationsPerCase} independent replications of {summary.durationHoursPerReplication}h
                            each per configuration. The dashed line marks the {summary.toleranceThresholdPercent}% tolerance
                            bound.
                        </p>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 40, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} angle={-30} textAnchor="end" interval={0} height={70} />
                                    <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `${v}%`} />
                                    <RechartsTooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }} />
                                    <Legend />
                                    <ReferenceLine y={summary.toleranceThresholdPercent} stroke="#ef4444" strokeDasharray="4 4" />
                                    <Bar dataKey="Wq error %" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Lq error %" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-100">
                            <h2 className="text-lg font-bold text-slate-900">Full Results</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-3">Configuration</th>
                                        <th className="px-4 py-3">Theoretical Wq</th>
                                        <th className="px-4 py-3">Simulated Wq (± 95% CI)</th>
                                        <th className="px-4 py-3">Wq Error</th>
                                        <th className="px-4 py-3">Lq Error</th>
                                        <th className="px-4 py-3">ρ Error</th>
                                        <th className="px-4 py-3">Result</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summary.cases.map((c, i) => (
                                        <tr key={i} className="border-b hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium text-slate-900">{c.label}</td>
                                            <td className="px-4 py-3">{(c.theoretical.Wq * 60).toFixed(2)} min</td>
                                            <td className="px-4 py-3">
                                                {(c.simulated.Wq * 60).toFixed(2)} ± {(c.marginOfError.Wq * 60).toFixed(2)} min
                                            </td>
                                            <td className="px-4 py-3">{c.percentError.Wq.toFixed(2)}%</td>
                                            <td className="px-4 py-3">{c.percentError.Lq.toFixed(2)}%</td>
                                            <td className="px-4 py-3">{c.percentError.rho.toFixed(2)}%</td>
                                            <td className="px-4 py-3">
                                                {c.withinTolerance ? (
                                                    <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                                                        <CheckCircle2 className="w-4 h-4" /> Pass
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                                                        <XCircle className="w-4 h-4" /> Above tolerance
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm text-slate-600">
                        <strong className="text-slate-800">Reading the near-critical cases:</strong> configurations with
                        ρ close to 1 (e.g. the ρ≈0.95 case) naturally show wider confidence intervals and can occasionally
                        exceed the tolerance band — this is expected, well-documented behaviour of finite-horizon queueing
                        simulation near saturation (queue lengths grow without bound as ρ→1, so any finite simulation run
                        underestimates the true steady state to some degree). This is worth stating explicitly in your
                        report rather than treating it as a bug.
                    </div>
                </>
            )}
        </div>
    );
}
