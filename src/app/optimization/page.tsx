"use client";

import { useState } from "react";
import { Target, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { MetricCard } from "@/components/queue/ResultsCard";
import { NumberField } from "@/components/ui/NumberField";
import { OptimizationResult } from "@/lib/optimization";
import { fmtNum, fmtMinutes } from "@/lib/format";

export default function OptimizationPage() {
    const [loading, setLoading] = useState(false);
    const [inputs, setInputs] = useState({
        lambda: 10,
        mu: 4,
        targetWq: 0.5, // hours (30 minutes)
        maxC: 20,
    });
    const [result, setResult] = useState<OptimizationResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Avoids an "∞ min" display -- infinity has no meaningful finite unit.
    const fmtMin = (hours: number | null | undefined) => {
        const formatted = fmtMinutes(hours);
        return formatted === "\u221e" ? formatted : `${formatted} min`;
    };

    const handleOptimize = async () => {
        setError(null);
        if (inputs.mu <= 0) {
            setError("Service rate (μ) must be greater than 0.");
            return;
        }
        if (inputs.targetWq <= 0) {
            setError("Max wait time must be greater than 0.");
            return;
        }
        if (inputs.maxC < 1) {
            setError("Max doctors to consider must be at least 1.");
            return;
        }
        setLoading(true);
        try {
            const response = await fetch("/api/queue/optimize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(inputs),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Optimization failed");
            setResult(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div>
                <h2 className="text-3xl font-bold text-slate-800">Staffing Optimization</h2>
                <p className="text-slate-500 mt-1">Find the minimum number of doctors required to meet a wait-time target (SLA).</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white p-6 rounded-xl border border-slate-100 h-fit">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Target className="w-5 h-5 text-teal-500" /> Targets
                    </h3>

                    <div className="space-y-4">
                        <NumberField
                            label="Arrival Rate (λ)"
                            value={inputs.lambda}
                            onChange={(v) => setInputs({ ...inputs, lambda: v })}
                        />
                        <NumberField
                            label="Service Rate (μ)"
                            value={inputs.mu}
                            onChange={(v) => setInputs({ ...inputs, mu: v })}
                        />
                        <NumberField
                            label="Max Wait Time (Hours)"
                            value={inputs.targetWq}
                            onChange={(v) => setInputs({ ...inputs, targetWq: v })}
                            step={0.1}
                            hint={`Target Wq: ${(inputs.targetWq * 60).toFixed(0)} minutes`}
                        />
                        <NumberField
                            label="Max Doctors to Consider"
                            value={inputs.maxC}
                            onChange={(v) => setInputs({ ...inputs, maxC: Math.max(1, Math.round(v)) })}
                            min={1}
                            hint="Must be at least 1."
                        />

                        <button
                            onClick={handleOptimize}
                            disabled={loading}
                            className="btn-primary w-full bg-teal-600 hover:bg-teal-700 text-white p-3 rounded-lg flex items-center justify-center gap-2"
                        >
                            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                            {loading ? "Optimizing..." : "Find Optimal Staffing"}
                        </button>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                {error}
                            </div>
                        )}
                    </div>
                </div>

                <div className="md:col-span-2 space-y-6">
                    {result && (
                        <div className="space-y-6">
                            <div className={`p-6 rounded-xl border-l-4 ${result.found ? "bg-green-50 border-green-500" : "bg-red-50 border-red-500"}`}>
                                <div className="flex items-start gap-4">
                                    {result.found ? <CheckCircle className="w-8 h-8 text-green-600" /> : <AlertTriangle className="w-8 h-8 text-red-600" />}
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800">
                                            {result.found ? `Optimal Staffing: ${result.optimalC} Doctors` : "Solution Not Found"}
                                        </h3>
                                        <p className="text-slate-600 mt-1">
                                            {result.found
                                                ? `With ${result.optimalC} doctors, the average wait time is ${(result.metrics.Wq * 60).toFixed(1)} minutes, meeting your target of < ${(inputs.targetWq * 60).toFixed(0)} mins.`
                                                : `Could not meet the target within the max servers considered (${inputs.maxC}). Try raising the target wait time or the max doctor count.`}
                                        </p>
                                        {!result.found && (
                                            <p className="text-slate-500 text-sm mt-3 pt-3 border-t border-red-200">
                                                {result.metrics.rho >= 1 ? (
                                                    inputs.lambda > inputs.maxC * inputs.mu ? (
                                                        <>
                                                            <strong>Why:</strong> at {inputs.maxC} doctors, this department can treat at most{" "}
                                                            {(inputs.maxC * inputs.mu).toFixed(0)} patients/hour, but {inputs.lambda} are
                                                            arriving — literally more than it can ever treat, even with zero patients waiting.
                                                            The queue grows without end, so the wait time is mathematically infinite
                                                            (utilization {(result.metrics.rho * 100).toFixed(0)}%). This needs meaningfully
                                                            more doctors, not just one or two more.
                                                        </>
                                                    ) : (
                                                        <>
                                                            <strong>Why:</strong> at {inputs.maxC} doctors, this department can treat exactly{" "}
                                                            {(inputs.maxC * inputs.mu).toFixed(0)} patients/hour, and {inputs.lambda} are
                                                            arriving — the same number, not more. That sounds like it should just barely work,
                                                            but it doesn&apos;t: patients don&apos;t arrive at perfectly even intervals, so
                                                            there&apos;s no spare capacity to absorb random busier stretches. Over time the
                                                            queue still grows without bound (utilization exactly 100%). Even one additional
                                                            doctor of spare capacity fixes this.
                                                        </>
                                                    )
                                                ) : (
                                                    <>
                                                        <strong>Why:</strong> even fully staffed at {inputs.maxC} doctors, the average wait is{" "}
                                                        {fmtMin(result.metrics.Wq)} — still above your {(inputs.targetWq * 60).toFixed(0)}-minute
                                                        target. The department is stable (utilization {(result.metrics.rho * 100).toFixed(0)}%),
                                                        it just needs either a higher doctor limit to search, or a more relaxed target.
                                                    </>
                                                )}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <MetricCard label="Resulting Utilization" value={`${(result.metrics.rho * 100).toFixed(1)}%`} highlight={result.metrics.rho > 0.8} />
                                <MetricCard label="Avg Queue Length" value={fmtNum(result.metrics.Lq, 2)} />
                                <MetricCard label="Avg Wait (Wq)" value={fmtMin(result.metrics.Wq)} subtext={`Target: < ${(inputs.targetWq * 60).toFixed(0)} min`} highlight />
                                <MetricCard label="System Time (W)" value={fmtMin(result.metrics.W)} />
                            </div>
                        </div>
                    )}

                    {!result && (
                        <div className="h-full min-h-55 flex flex-col items-center justify-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
                            <Target className="w-12 h-12 mb-4 opacity-50" />
                            <p>Set your parameters and target wait time, then run the optimizer.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
