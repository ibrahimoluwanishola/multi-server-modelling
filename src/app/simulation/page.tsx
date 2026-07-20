"use client";

import { useState } from "react";
import { PlayCircle, RefreshCw, AlertTriangle, Settings } from "lucide-react";
import { ReplicatedSimulationResult } from "@/types/queue";
import { MetricCard } from "@/components/queue/ResultsCard";
import { NumberField } from "@/components/ui/NumberField";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";

export default function SimulationPage() {
    const [loading, setLoading] = useState(false);
    const [inputs, setInputs] = useState({
        lambda: 10,
        mu: 4,
        c: 3,
        duration: 8,
        replications: 10,
        seed: 12345,
    });
    const [result, setResult] = useState<ReplicatedSimulationResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSimulate = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch("/api/queue/simulate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(inputs),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Simulation failed");
            }

            setResult(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    const recommendedDoctors = Math.max(inputs.c, Math.ceil(inputs.lambda / (inputs.mu * 0.82)));
    const expectedServiceMins = Math.max(1, (1 / inputs.mu) * 60).toFixed(0);

    const fmtMinutes = (hours: number) => `${(hours * 60).toFixed(2)} min`;
    const fmtCI = (ci: { mean: number; marginOfError: number }, formatter: (n: number) => string) =>
        `${formatter(ci.mean)} ± ${formatter(ci.marginOfError)}`;

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800">Queue Simulation</h2>
                    <p className="text-slate-500 mt-1">
                        Discrete-event simulation with multiple independent replications, a warm-up period to remove
                        initial-transient bias, and a seeded RNG so results are reproducible.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="bg-white p-6 rounded-xl border border-slate-100 h-fit">
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                        <Settings className="w-5 h-5 text-blue-500" /> Configuration
                    </h3>

                    <div className="space-y-4">
                        <NumberField
                            label="Arrival Rate (λ)"
                            value={inputs.lambda}
                            onChange={(v) => setInputs({ ...inputs, lambda: v })}
                            hint="Patients per hour"
                        />
                        <NumberField
                            label="Service Rate (μ)"
                            value={inputs.mu}
                            onChange={(v) => setInputs({ ...inputs, mu: v })}
                            hint="Patients served per hour per doctor"
                        />
                        <NumberField
                            label="Number of Doctors (c)"
                            value={inputs.c}
                            onChange={(v) => setInputs({ ...inputs, c: v })}
                        />
                        <NumberField
                            label="Duration (Hours)"
                            value={inputs.duration}
                            onChange={(v) => setInputs({ ...inputs, duration: v })}
                        />
                        <NumberField
                            label="Replications"
                            value={inputs.replications}
                            onChange={(v) => setInputs({ ...inputs, replications: v })}
                            min={1}
                            max={50}
                            hint="More replications → tighter 95% confidence interval."
                        />
                        <NumberField
                            label="Random Seed"
                            value={inputs.seed}
                            onChange={(v) => setInputs({ ...inputs, seed: v })}
                            hint="Same seed + inputs always reproduces the same run."
                        />

                        <button
                            onClick={handleSimulate}
                            disabled={loading}
                            className="btn-primary w-full mt-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2"
                        >
                            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
                            {loading ? "Simulating..." : "Run Simulation"}
                        </button>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                {error}
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    {result ? (
                        <>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <MetricCard
                                    label="Utilization (ρ)"
                                    value={`${(result.rho.mean * 100).toFixed(1)}%`}
                                    subtext={`Theory: ${(result.theoretical.rho * 100).toFixed(1)}% · ±${(result.rho.marginOfError * 100).toFixed(1)}%`}
                                />
                                <MetricCard
                                    label="Avg Wait (Wq)"
                                    value={fmtMinutes(result.Wq.mean)}
                                    subtext={`Theory: ${result.theoretical.Wq !== Infinity ? fmtMinutes(result.theoretical.Wq) : "∞"}`}
                                />
                                <MetricCard
                                    label="Queue Length (Lq)"
                                    value={result.Lq.mean.toFixed(2)}
                                    subtext={`Theory: ${result.theoretical.Lq !== Infinity ? result.theoretical.Lq.toFixed(2) : "∞"}`}
                                />
                                <MetricCard
                                    label="System Time (W)"
                                    value={fmtMinutes(result.W.mean)}
                                    subtext={`Theory: ${result.theoretical.W !== Infinity ? fmtMinutes(result.theoretical.W) : "∞"}`}
                                />
                            </div>

                            <div className="bg-white p-6 rounded-xl border border-slate-100">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-lg font-bold">Staffing Snapshot</h3>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="rounded-xl border border-slate-200 p-4">
                                        <p className="text-sm text-slate-500">Recommended doctors (≈80% utilization target)</p>
                                        <p className="mt-2 text-2xl font-bold text-slate-900">{recommendedDoctors} doctors</p>
                                        <p className="text-sm text-slate-500 mt-2">
                                            For an exact minimum-staffing answer against a wait-time SLA, use the Optimization page.
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 p-4">
                                        <p className="text-sm text-slate-500">Mean service time</p>
                                        <p className="mt-2 text-2xl font-bold text-slate-900">{expectedServiceMins} min/patient</p>
                                        <p className="text-sm text-slate-500 mt-2">Faster consultations reduce queue length and wait times.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl border border-slate-100">
                                <h3 className="text-lg font-bold mb-4">Simulation vs. Theory</h3>
                                <p className="text-slate-500 mb-2">
                                    Mean ± 95% confidence interval across {result.replications} independent replications
                                    (first {result.warmUpHours.toFixed(2)}h of each run excluded as warm-up, seed = {result.seed}).
                                </p>

                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                                        <tr>
                                            <th className="px-6 py-3">Metric</th>
                                            <th className="px-6 py-3">Simulated (mean ± 95% CI)</th>
                                            <th className="px-6 py-3">Theoretical</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <ResultRow
                                            label="Server Utilization (ρ)"
                                            sim={fmtCI(result.rho, (n) => `${(n * 100).toFixed(1)}%`)}
                                            theo={`${(result.theoretical.rho * 100).toFixed(1)}%`}
                                        />
                                        <ResultRow
                                            label="Avg Queue Length (Lq)"
                                            sim={fmtCI(result.Lq, (n) => n.toFixed(3))}
                                            theo={result.theoretical.Lq !== Infinity ? result.theoretical.Lq.toFixed(3) : "∞"}
                                        />
                                        <ResultRow
                                            label="Avg Wait in Queue (Wq)"
                                            sim={fmtCI(result.Wq, fmtMinutes)}
                                            theo={result.theoretical.Wq !== Infinity ? fmtMinutes(result.theoretical.Wq) : "∞"}
                                        />
                                        <ResultRow
                                            label="Avg System Time (W)"
                                            sim={fmtCI(result.W, fmtMinutes)}
                                            theo={result.theoretical.W !== Infinity ? fmtMinutes(result.theoretical.W) : "∞"}
                                        />
                                    </tbody>
                                </table>
                            </div>

                            <div className="bg-white p-6 rounded-xl border border-slate-100 mt-6">
                                <h3 className="text-lg font-bold mb-4">Queue Length Timeline (Replication 1)</h3>
                                <p className="text-slate-500 mb-6">
                                    Sample path from the first replication, shown for intuition — the summary statistics above
                                    are averaged across all {result.replications} replications, not just this one.
                                </p>
                                <div className="h-72 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={result.sampleLogs} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                            <XAxis
                                                dataKey="time"
                                                type="number"
                                                tickFormatter={(val) => `${val.toFixed(1)}h`}
                                                stroke="#94a3b8"
                                                fontSize={12}
                                            />
                                            <YAxis stroke="#94a3b8" fontSize={12} />
                                            <RechartsTooltip
                                                formatter={(value?: number) => [value ?? 0, "Queue Length"]}
                                                labelFormatter={(label: React.ReactNode) => `Time: ${Number(label ?? 0).toFixed(2)}h`}
                                                contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                                            />
                                            <Legend />
                                            <Line
                                                type="stepAfter"
                                                dataKey="queueLength"
                                                name="Patients in Queue"
                                                stroke="#3b82f6"
                                                strokeWidth={2}
                                                dot={false}
                                                activeDot={{ r: 6 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl border border-slate-100 mt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold">Simulation Event Log (Replication 1)</h3>
                                    <p className="text-sm text-slate-500">First 10 events</p>
                                </div>
                                <div className="space-y-3">
                                    {result.sampleLogs.slice(0, 10).map((log, index) => (
                                        <div key={index} className="rounded-2xl border border-slate-200 p-3 bg-slate-50">
                                            <div className="flex items-center justify-between text-sm text-slate-700">
                                                <span>{log.event}</span>
                                                <span>{log.time.toFixed(2)}h</span>
                                            </div>
                                            <div className="mt-2 text-xs text-slate-500">
                                                Queue: {log.queueLength} • Busy servers: {log.busyServers}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="h-full min-h-55 flex flex-col items-center justify-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
                            <PlayCircle className="w-12 h-12 mb-4 opacity-50" />
                            <p>Enter parameters and run simulation to see results.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ResultRow({ label, sim, theo }: { label: string; sim: string; theo: string }) {
    return (
        <tr className="bg-white border-b hover:bg-slate-50">
            <td className="px-6 py-4 font-medium text-slate-900">{label}</td>
            <td className="px-6 py-4 text-blue-600 font-semibold">{sim}</td>
            <td className="px-6 py-4 text-slate-500">{theo}</td>
        </tr>
    );
}
