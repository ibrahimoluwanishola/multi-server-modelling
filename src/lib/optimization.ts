import { calculateMMC, MMCResults } from './mmc';

export interface OptimizationResult {
    optimalC: number;
    metrics: MMCResults;
    targetWq: number;
    found: boolean;
}

/**
 * Finds the minimum number of servers (c) required to achieve a target wait time (Wq)
 * @param lambda Arrival rate
 * @param mu Service rate
 * @param targetWq Maximum acceptable average wait time in queue (in same time units as rate, e.g. hours)
 * @param maxC Maximum number of servers to test (default 100)
 */
export function optimizeServers(
    lambda: number,
    mu: number,
    targetWq: number,
    maxC: number = 100
): OptimizationResult {
    // BUG FIX: `maxC` was previously used unchecked. If a caller passed
    // maxC = 0 (e.g. an emptied/invalid form field on the client sending
    // `0`), the loop below would never execute, and the "not found" fallback
    // used to call `calculateMMC(lambda, mu, maxC)` with maxC = 0, which
    // calculateMMC correctly rejects as an invalid server count and THROWS —
    // crashing the whole request with a 500 error instead of a clean
    // "couldn't find a solution" response. Clamping here means this function
    // can never throw because of a bad maxC value, regardless of what the
    // caller passes in.
    const safeMaxC = Math.max(1, Math.floor(maxC) || 1);

    // Start checking from c=1. For stability, we need c > lambda/mu.
    // So we can start slightly higher to save iterations, but 1 is safe.
    // Actually, min stable c is floor(lambda/mu) + 1.
    const minStableC = Math.max(1, Math.floor(lambda / mu) + 1);

    for (let c = minStableC; c <= safeMaxC; c++) {
        const results = calculateMMC(lambda, mu, c);

        if (results.stable && results.Wq <= targetWq) {
            return {
                optimalC: c,
                metrics: results,
                targetWq,
                found: true,
            };
        }
    }

    return {
        optimalC: -1,
        metrics: calculateMMC(lambda, mu, safeMaxC), // Return metrics for maxC; safeMaxC >= 1 always
        targetWq,
        found: false,
    };
}
