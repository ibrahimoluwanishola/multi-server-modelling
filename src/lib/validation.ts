import { MMCResults } from "@/types/queue";
import { calculateMMC } from "./mmc";
import { simulateMMC } from "./simulation";

/**
 * Systematic validation of the discrete-event simulation against the exact
 * M/M/c analytical formulae, across a deliberately wide range of parameter
 * configurations (light, moderate, heavy, and near-critical utilization, at
 * several server counts). This is the evidence base for the project's
 * accuracy-validation objective: rather than eyeballing one simulation run
 * against its theoretical counterpart, this runs many independent
 * configurations and reports the error distribution as a whole.
 */

export interface ValidationCase {
    label: string;
    lambda: number;
    mu: number;
    c: number;
    theoretical: MMCResults;
    simulated: {
        rho: number;
        Lq: number;
        Wq: number;
        L: number;
        W: number;
    };
    marginOfError: {
        rho: number;
        Lq: number;
        Wq: number;
        L: number;
        W: number;
    };
    percentError: {
        rho: number;
        Lq: number;
        Wq: number;
        L: number;
        W: number;
    };
    withinTolerance: boolean;
}

export interface ValidationSummary {
    cases: ValidationCase[];
    meanAbsolutePercentError: number;
    maxAbsolutePercentError: number;
    casesWithinTolerance: number;
    totalCases: number;
    toleranceThresholdPercent: number;
    replicationsPerCase: number;
    durationHoursPerReplication: number;
}

// Deliberately spans light, moderate, heavy, and near-critical utilization
// at c = 1, 2, and 4 servers, so the validation isn't confined to a single
// "friendly" configuration.
const SWEEP_CONFIGS: { label: string; lambda: number; mu: number; c: number }[] = [
    { label: "Light load, c=1 (ρ=0.30)", lambda: 1.5, mu: 5, c: 1 },
    { label: "Moderate load, c=1 (ρ=0.60)", lambda: 3, mu: 5, c: 1 },
    { label: "Heavy load, c=1 (ρ=0.85)", lambda: 4.25, mu: 5, c: 1 },
    { label: "Light load, c=2 (ρ=0.35)", lambda: 3.5, mu: 5, c: 2 },
    { label: "Moderate load, c=2 (ρ=0.65)", lambda: 6.5, mu: 5, c: 2 },
    { label: "Heavy load, c=2 (ρ=0.90)", lambda: 9, mu: 5, c: 2 },
    { label: "Moderate load, c=4 (ρ=0.70)", lambda: 14, mu: 5, c: 4 },
    { label: "Heavy load, c=4 (ρ=0.88)", lambda: 17.6, mu: 5, c: 4 },
    { label: "Near-critical, c=4 (ρ=0.95)", lambda: 19, mu: 5, c: 4 },
    { label: "Classic textbook case, c=3 (ρ=0.83)", lambda: 10, mu: 4, c: 3 },
];

const TOLERANCE_PERCENT = 15; // generous but meaningful bound for a stochastic simulation
const REPLICATIONS = 50; // the maximum simulateMMC allows, to minimize confidence-interval width
const DURATION_HOURS = 150; // long enough that even near-critical (ρ≈0.95) configurations clear their warm-up transient

function percentError(simulated: number, theoretical: number): number {
    if (!Number.isFinite(theoretical) || theoretical === 0) return 0;
    return (Math.abs(simulated - theoretical) / theoretical) * 100;
}

export function runValidationSweep(): ValidationSummary {
    const cases: ValidationCase[] = SWEEP_CONFIGS.map((config) => {
        const theoretical = calculateMMC(config.lambda, config.mu, config.c);
        const sim = simulateMMC(config.lambda, config.mu, config.c, DURATION_HOURS, {
            replications: REPLICATIONS,
            seed: 1000 + config.c * 97 + Math.round(config.lambda * 10),
        });

        const simulated = {
            rho: sim.rho.mean,
            Lq: sim.Lq.mean,
            Wq: sim.Wq.mean,
            L: sim.L.mean,
            W: sim.W.mean,
        };

        const marginOfError = {
            rho: sim.rho.marginOfError,
            Lq: sim.Lq.marginOfError,
            Wq: sim.Wq.marginOfError,
            L: sim.L.marginOfError,
            W: sim.W.marginOfError,
        };

        const errors = {
            rho: percentError(simulated.rho, theoretical.rho),
            Lq: percentError(simulated.Lq, theoretical.Lq),
            Wq: percentError(simulated.Wq, theoretical.Wq),
            L: percentError(simulated.L, theoretical.L),
            W: percentError(simulated.W, theoretical.W),
        };

        const maxErrorForCase = Math.max(errors.rho, errors.Lq, errors.Wq, errors.L, errors.W);

        return {
            label: config.label,
            lambda: config.lambda,
            mu: config.mu,
            c: config.c,
            theoretical,
            simulated,
            marginOfError,
            percentError: errors,
            withinTolerance: maxErrorForCase <= TOLERANCE_PERCENT,
        };
    });

    const allErrors = cases.flatMap((c) => Object.values(c.percentError));
    const meanAbsolutePercentError = allErrors.reduce((a, b) => a + b, 0) / allErrors.length;
    const maxAbsolutePercentError = Math.max(...allErrors);
    const casesWithinTolerance = cases.filter((c) => c.withinTolerance).length;

    return {
        cases,
        meanAbsolutePercentError: Number(meanAbsolutePercentError.toFixed(2)),
        maxAbsolutePercentError: Number(maxAbsolutePercentError.toFixed(2)),
        casesWithinTolerance,
        totalCases: cases.length,
        toleranceThresholdPercent: TOLERANCE_PERCENT,
        replicationsPerCase: REPLICATIONS,
        durationHoursPerReplication: DURATION_HOURS,
    };
}
