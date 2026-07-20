import { MMCResults } from "@/types/queue";

/**
 * Calculates factorial of a number.
 * Uses the standard iterative definition. For c above ~170 this would
 * overflow a JS double, but real hospital departments never run into
 * hundreds of parallel servers, so this is safe for this domain.
 */
function factorial(n: number): number {
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) {
        result *= i;
    }
    return result;
}

export type { MMCResults };

/**
 * Calculates M/M/c queue metrics
 * @param lambda Arrival rate (λ)
 * @param mu Service rate (μ)
 * @param c Number of servers
 */
export function calculateMMC(lambda: number, mu: number, c: number): MMCResults {
    // Validate inputs to prevent division by zero or negative values if not handled by caller
    if (lambda < 0 || mu <= 0 || c < 1) {
        throw new Error("Invalid inputs: lambda must be >= 0, mu > 0, c >= 1");
    }

    // Degenerate but valid case: no arrivals at all. Every downstream formula
    // that divides by lambda (Wq = Lq / lambda) would otherwise produce NaN.
    if (lambda === 0) {
        return { rho: 0, P0: 1, Lq: 0, Wq: 0, L: 0, W: 1 / mu, stable: true };
    }

    const rho = lambda / (c * mu);

    if (rho >= 1) {
        return {
            rho,
            P0: 0,
            Lq: Infinity,
            Wq: Infinity,
            L: Infinity,
            W: Infinity,
            stable: false,
        };
    }

    // Calculate P0
    let sum = 0;
    for (let n = 0; n < c; n++) {
        sum += Math.pow(lambda / mu, n) / factorial(n);
    }

    const termC = (Math.pow(lambda / mu, c) / (factorial(c) * (1 - rho)));
    const P0 = 1 / (sum + termC);

    // Calculate Lq
    const Lq = (Math.pow(lambda / mu, c) * rho * P0) / (factorial(c) * Math.pow(1 - rho, 2));

    // Calculate Wq
    const Wq = Lq / lambda;

    // Calculate L
    const L = Lq + (lambda / mu);

    // Calculate W
    const W = Wq + (1 / mu);

    return {
        rho,
        P0,
        Lq,
        Wq,
        L,
        W,
        stable: true,
    };
}
