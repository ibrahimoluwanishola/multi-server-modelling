"use client";

import { useEffect, useState } from "react";
import { Sparkles, RefreshCw, AlertTriangle, BrainCircuit } from "lucide-react";
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import { DepartmentWithMetrics, ForecastResult } from "@/types/queue";
import { NumberField } from "@/components/ui/NumberField";

export default function ForecastPage() {
    const [departments, setDepartments] = useState<DepartmentWithMetrics[]>([]);
    const [departmentId, setDepartmentId] = useState<string>("");
    const [targetWqMinutes, setTargetWqMinutes] = useState(20);
    const [result, setResult] = useState<ForecastResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/departments")
            .then((res) => res.json())
            .then((data) => {
                const list: DepartmentWithMetrics[] = data.departments || [];
                setDepartments(list);
                if (list.length) setDepartmentId(list[0].id);
            });
    }, []);

    const handleForecast = async () => {
        if (!departmentId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/ml/forecast", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ departmentId, targetWqMinutes }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Forecast failed");
            setResult(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    const peakHour =
        result && result.points.length > 0
            ? result.points.reduce((a, b) => (b.predictedLambda > a.predictedLambda ? b : a))
            : null;

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div>
                <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
                    <Sparkles className="w-7 h-7 text-violet-500" /> ML-Driven Demand Forecast
                </h2>
                <p className="text-slate-500 mt-1 max-w-3xl">
                    A harmonic linear-regression model trained on this department&apos;s real logged check-ins predicts
                    its hourly arrival rate (λ) over a 24-hour cycle, then feeds that prediction straight into the same
                    M/M/c optimiser used on the Optimization page to recommend how many doctors are needed, hour by hour.
                    No synthetic or seeded data is used — if there isn&apos;t enough real history yet, this page says so.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="bg-white p-6 rounded-xl border border-slate-100 h-fit space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                        <select
                            value={departmentId}
                            onChange={(e) => setDepartmentId(e.target.value)}
                            className="input-field"
                        >
                            {departments.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <NumberField
                        label="Target Wait Time (minutes)"
                        value={targetWqMinutes}
                        onChange={setTargetWqMinutes}
                        min={1}
                    />
                    <button
                        onClick={handleForecast}
                        disabled={loading || !departmentId}
                        className="btn-primary w-full bg-violet-600 hover:bg-violet-700 text-white p-3 rounded-lg flex items-center justify-center gap-2"
                    >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                        {loading ? "Training + Forecasting..." : "Train Model & Forecast"}
                    </button>
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            {error}
                        </div>
                    )}

                    {result && result.sufficientData && (
                        <div className="rounded-xl border border-slate-200 p-4 space-y-2 text-sm">
                            <p className="font-semibold text-slate-800">Model details</p>
                            <p className="text-slate-500">{result.model.type}</p>
                            <p className="text-slate-500">
                                Trained on {result.dataStatus.visitsRecorded} real check-ins across{" "}
                                {result.dataStatus.distinctDaysRecorded} distinct days.
                            </p>
                            <p className="text-slate-500">
                                In-sample fit: <span className="font-semibold text-slate-700">R² = {result.model.rSquared}</span>
                            </p>
                        </div>
                    )}
                </div>

                <div className="lg:col-span-2 space-y-6">
                    {result && !result.sufficientData ? (
                        <div className="h-full min-h-55 flex flex-col items-center justify-center bg-amber-50 rounded-xl border-2 border-dashed border-amber-200 text-amber-800 p-8 text-center">
                            <BrainCircuit className="w-12 h-12 mb-4 opacity-60" />
                            <p className="font-semibold">Not enough real data yet to train a forecast</p>
                            <p className="text-sm mt-2 max-w-md">
                                This department has {result.dataStatus.visitsRecorded} logged check-in
                                {result.dataStatus.visitsRecorded === 1 ? "" : "s"} across {result.dataStatus.distinctDaysRecorded}{" "}
                                distinct day{result.dataStatus.distinctDaysRecorded === 1 ? "" : "s"}, spread across{" "}
                                {result.dataStatus.distinctHourBucketsRecorded} different hour{result.dataStatus.distinctHourBucketsRecorded === 1 ? "" : "s"} of
                                the day. The model needs at least {result.dataStatus.visitsNeeded} check-ins across{" "}
                                {result.dataStatus.daysNeeded} distinct days and {result.dataStatus.hourBucketsNeeded} different hours
                                before it will train — this is a deliberate honesty check, not a bug: it means no forecast is
                                ever shown that was invented from synthetic data, or fit from too few real data points to be
                                numerically meaningful.
                            </p>
                            <p className="text-sm mt-3">
                                Check patients in via <span className="font-semibold">Reception</span> at a variety of times over
                                a few days to build up real history.
                            </p>
                        </div>
                    ) : result && result.sufficientData ? (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-white p-4 rounded-xl border border-slate-100">
                                    <p className="text-xs uppercase text-slate-400 font-medium">Peak Hour</p>
                                    <p className="text-2xl font-bold text-slate-900 mt-1">{peakHour?.hour}:00</p>
                                    <p className="text-sm text-slate-500 mt-1">λ ≈ {peakHour?.predictedLambda}/hr predicted</p>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-slate-100">
                                    <p className="text-xs uppercase text-slate-400 font-medium">Peak Staffing Need</p>
                                    <p className="text-2xl font-bold text-slate-900 mt-1">{peakHour?.recommendedC} doctors</p>
                                    <p className="text-sm text-slate-500 mt-1">To hold Wq under {result.targetWqMinutes} min</p>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-slate-100">
                                    <p className="text-xs uppercase text-slate-400 font-medium">Off-Peak Minimum</p>
                                    <p className="text-2xl font-bold text-slate-900 mt-1">
                                        {Math.min(...result.points.map((p) => p.recommendedC))} doctors
                                    </p>
                                    <p className="text-sm text-slate-500 mt-1">Lowest hourly staffing requirement</p>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl border border-slate-100">
                                <h3 className="text-lg font-bold mb-1">Predicted Arrivals &amp; Recommended Staffing (24h)</h3>
                                <p className="text-slate-500 text-sm mb-6">
                                    Bars: predicted arrivals per hour (λ). Line: minimum doctors recommended for that hour.
                                </p>
                                <div className="h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={result.points} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                            <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} stroke="#94a3b8" fontSize={12} />
                                            <YAxis yAxisId="left" stroke="#94a3b8" fontSize={12} />
                                            <YAxis yAxisId="right" orientation="right" stroke="#7c3aed" fontSize={12} allowDecimals={false} />
                                            <RechartsTooltip
                                                labelFormatter={(h) => `${h}:00`}
                                                contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                                            />
                                            <Legend />
                                            <Bar yAxisId="left" dataKey="predictedLambda" name="Predicted λ (patients/hr)" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                                            <Line
                                                yAxisId="right"
                                                type="stepAfter"
                                                dataKey="recommendedC"
                                                name="Recommended doctors"
                                                stroke="#7c3aed"
                                                strokeWidth={2}
                                                dot={{ r: 3 }}
                                            />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl border border-slate-100">
                                <h3 className="text-lg font-bold mb-4">Hourly Staffing Plan</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                                            <tr>
                                                <th className="px-4 py-3">Hour</th>
                                                <th className="px-4 py-3">Predicted λ</th>
                                                <th className="px-4 py-3">Recommended Doctors</th>
                                                <th className="px-4 py-3">Predicted Wq</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.points.map((p) => (
                                                <tr key={p.hour} className="border-b hover:bg-slate-50">
                                                    <td className="px-4 py-2 font-medium">{p.hour}:00</td>
                                                    <td className="px-4 py-2">{p.predictedLambda}</td>
                                                    <td className="px-4 py-2">{p.recommendedC}</td>
                                                    <td className="px-4 py-2">
                                                        {Number.isFinite(p.predictedWqMinutes) ? `${p.predictedWqMinutes} min` : "—"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="h-full min-h-55 flex flex-col items-center justify-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
                            <Sparkles className="w-12 h-12 mb-4 opacity-50" />
                            <p>Choose a department and train the forecasting model to see results.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
