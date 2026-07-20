import { ForecastPoint, ForecastResult } from "@/types/queue";
import { optimizeServers } from "@/lib/optimization";
import { getDepartment } from "@/lib/server/department-store";
import { listVisits } from "@/lib/server/visit-store";

/**
 * Machine-learning demand forecasting module — trained on REAL check-in
 * data only.
 *
 * MODEL — harmonic (sinusoidal) linear regression:
 *     lambda(h) ≈ b0 + b1*sin(2πh/24) + b2*cos(2πh/24)
 *                    + b3*sin(4πh/24) + b4*cos(4πh/24) + b5*isWeekend
 * fit by ordinary least squares via the normal equations (closed-form, fully
 * explainable — every coefficient is directly interpretable, no opaque
 * external ML library).
 *
 * DATA: this trains on the hour-of-day of every real patient check-in
 * recorded in src/lib/server/visit-store.ts. There is no synthetic or
 * seeded training set anymore. Because a fresh deployment starts with zero
 * visits, this module is explicit about the minimum amount of real data it
 * needs (MIN_VISITS across MIN_DAYS distinct days) before it will produce a
 * forecast — if that bar isn't met, it returns `sufficientData: false`
 * rather than fabricating a curve, and the UI must present that honestly.
 */

const MIN_VISITS = 20;
const MIN_DISTINCT_DAYS = 2;
// The regression has 6 parameters (intercept + 4 harmonic terms + weekend
// indicator); fitting it against fewer distinct (hour, weekend) buckets than
// that makes the normal-equations matrix singular or numerically unstable —
// technically "solvable" (a fallback epsilon avoids a literal crash) but the
// resulting coefficients would be meaningless. Requiring comfortably more
// buckets than parameters keeps this an actual regression, not an exact
// interpolation through too few points. This matters in practice: it's easy
// to rack up MIN_VISITS by rapidly checking in test patients within a single
// testing session, which would otherwise pass the visits/days checks while
// still being concentrated in only one or two hour buckets.
const MIN_DISTINCT_BUCKETS = 10;

type Matrix = number[][];

function transpose(m: Matrix): Matrix {
    return m[0].map((_, colIndex) => m.map((row) => row[colIndex]));
}

function multiply(a: Matrix, b: Matrix): Matrix {
    const result: Matrix = [];
    for (let i = 0; i < a.length; i++) {
        result.push([]);
        for (let j = 0; j < b[0].length; j++) {
            let sum = 0;
            for (let k = 0; k < b.length; k++) sum += a[i][k] * b[k][j];
            result[i].push(sum);
        }
    }
    return result;
}

function solveLinearSystem(A: Matrix, b: Matrix): number[] {
    const n = A.length;
    const M = A.map((row, i) => [...row, b[i][0]]);
    for (let col = 0; col < n; col++) {
        let pivotRow = col;
        for (let row = col + 1; row < n; row++) {
            if (Math.abs(M[row][col]) > Math.abs(M[pivotRow][col])) pivotRow = row;
        }
        [M[col], M[pivotRow]] = [M[pivotRow], M[col]];
        const pivotVal = M[col][col] || 1e-9;
        for (let k = col; k <= n; k++) M[col][k] /= pivotVal;
        for (let row = 0; row < n; row++) {
            if (row === col) continue;
            const factor = M[row][col];
            for (let k = col; k <= n; k++) M[row][k] -= factor * M[col][k];
        }
    }
    return M.map((row) => row[n]);
}

function buildFeatureRow(hour: number, isWeekend: boolean): number[] {
    return [
        1,
        Math.sin((2 * Math.PI * hour) / 24),
        Math.cos((2 * Math.PI * hour) / 24),
        Math.sin((4 * Math.PI * hour) / 24),
        Math.cos((4 * Math.PI * hour) / 24),
        isWeekend ? 1 : 0,
    ];
}

export async function trainAndForecast(
    departmentId: string,
    targetWqMinutes: number = 20,
    maxC: number = 12
): Promise<ForecastResult | null> {
    const dept = await getDepartment(departmentId);
    if (!dept) return null;

    const visits = await listVisits({ departmentId });
    const distinctDays = new Set(visits.map((v) => v.checkedInAt.slice(0, 10)));

    // Aggregate real check-ins into (hour, isWeekend) -> count-per-day buckets,
    // so the regression target is "arrivals per hour" consistent with lambda.
    // Built before the sufficiency check below, since bucket count (not just
    // raw visit count) is one of the gating conditions.
    const bucketCounts = new Map<string, { hour: number; isWeekend: boolean; count: number; days: Set<string> }>();
    visits.forEach((v) => {
        const d = new Date(v.checkedInAt);
        const hour = d.getHours();
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const dayKey = v.checkedInAt.slice(0, 10);
        const key = `${hour}-${isWeekend}`;
        const entry = bucketCounts.get(key) || { hour, isWeekend, count: 0, days: new Set<string>() };
        entry.count += 1;
        entry.days.add(dayKey);
        bucketCounts.set(key, entry);
    });

    if (
        visits.length < MIN_VISITS ||
        distinctDays.size < MIN_DISTINCT_DAYS ||
        bucketCounts.size < MIN_DISTINCT_BUCKETS
    ) {
        return {
            departmentId: dept.id,
            departmentName: dept.name,
            mu: dept.mu,
            targetWqMinutes,
            points: [],
            model: {
                type: "Harmonic (sin/cos) Linear Regression — Ordinary Least Squares",
                features: ["intercept", "sin(2πh/24)", "cos(2πh/24)", "sin(4πh/24)", "cos(4πh/24)", "isWeekend"],
                trainingHours: 0,
                rSquared: 0,
            },
            sufficientData: false,
            dataStatus: {
                visitsRecorded: visits.length,
                distinctDaysRecorded: distinctDays.size,
                distinctHourBucketsRecorded: bucketCounts.size,
                visitsNeeded: MIN_VISITS,
                daysNeeded: MIN_DISTINCT_DAYS,
                hourBucketsNeeded: MIN_DISTINCT_BUCKETS,
            },
        };
    }

    const rows = [...bucketCounts.values()].map((b) => ({
        hour: b.hour,
        isWeekend: b.isWeekend,
        arrivalsPerHour: b.count / Math.max(b.days.size, 1),
    }));

    const X: Matrix = rows.map((r) => buildFeatureRow(r.hour, r.isWeekend));
    const y: Matrix = rows.map((r) => [r.arrivalsPerHour]);

    const Xt = transpose(X);
    const beta = solveLinearSystem(multiply(Xt, X), multiply(Xt, y));

    const predict = (hour: number, isWeekend: boolean) => {
        const row = buildFeatureRow(hour, isWeekend);
        const value = row.reduce((sum, val, idx) => sum + val * beta[idx], 0);
        return Math.max(0.05, value);
    };

    const yMean = y.reduce((s, r) => s + r[0], 0) / y.length;
    let ssRes = 0;
    let ssTot = 0;
    rows.forEach((r) => {
        const yHat = predict(r.hour, r.isWeekend);
        ssRes += (r.arrivalsPerHour - yHat) ** 2;
        ssTot += (r.arrivalsPerHour - yMean) ** 2;
    });
    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    const targetWqHours = targetWqMinutes / 60;
    const points: ForecastPoint[] = [];
    for (let hour = 0; hour < 24; hour++) {
        const predictedLambda = predict(hour, false);
        const opt = optimizeServers(predictedLambda, dept.mu, targetWqHours, maxC);
        points.push({
            hour,
            predictedLambda: Number(predictedLambda.toFixed(2)),
            recommendedC: opt.found ? opt.optimalC : maxC,
            predictedWqMinutes: opt.found ? Number((opt.metrics.Wq * 60).toFixed(1)) : Infinity,
        });
    }

    return {
        departmentId: dept.id,
        departmentName: dept.name,
        mu: dept.mu,
        targetWqMinutes,
        points,
        model: {
            type: "Harmonic (sin/cos) Linear Regression — Ordinary Least Squares",
            features: ["intercept", "sin(2πh/24)", "cos(2πh/24)", "sin(4πh/24)", "cos(4πh/24)", "isWeekend"],
            trainingHours: rows.length,
            rSquared: Number(rSquared.toFixed(3)),
        },
        sufficientData: true,
        dataStatus: {
            visitsRecorded: visits.length,
            distinctDaysRecorded: distinctDays.size,
            distinctHourBucketsRecorded: bucketCounts.size,
            visitsNeeded: MIN_VISITS,
            daysNeeded: MIN_DISTINCT_DAYS,
            hourBucketsNeeded: MIN_DISTINCT_BUCKETS,
        },
    };
}
