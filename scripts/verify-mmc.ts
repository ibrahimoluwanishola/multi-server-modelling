/**
 * Verifies the analytical M/M/c engine (src/lib/mmc.ts) against reference
 * values that are independently checkable by hand or against a published
 * Erlang-C calculator/table. This exists so the mathematical correctness of
 * the core engine is demonstrable, not just asserted, in an academic report.
 *
 * Run with: npm run verify:mmc
 */
import { calculateMMC } from "../src/lib/mmc";

interface Case {
    label: string;
    lambda: number;
    mu: number;
    c: number;
    expected: { rho: number; P0: number; Lq: number; Wq: number; L: number; W: number };
    tolerance: number;
}

const cases: Case[] = [
    {
        label: "lambda=10, mu=4, c=3",
        lambda: 10,
        mu: 4,
        c: 3,
        expected: { rho: 0.8333, P0: 0.0449, Lq: 3.5112, Wq: 0.3511, L: 6.0112, W: 0.6011 },
        tolerance: 0.01,
    },
    {
        label: "lambda=4, mu=2, c=3 (moderate load)",
        lambda: 4,
        mu: 2,
        c: 3,
        expected: { rho: 0.6667, P0: 0.1111, Lq: 0.8889, Wq: 0.2222, L: 2.8889, W: 0.7222 },
        tolerance: 0.01,
    },
    {
        label: "lambda=1, mu=2, c=1 (single-server M/M/1 sanity check)",
        lambda: 1,
        mu: 2,
        c: 1,
        // For M/M/1: rho = lambda/mu, P0 = 1-rho, Lq = rho^2/(1-rho), Wq = Lq/lambda
        expected: { rho: 0.5, P0: 0.5, Lq: 0.5, Wq: 0.5, L: 1.0, W: 1.0 },
        tolerance: 0.005,
    },
];

let allPassed = true;

console.log("Verifying src/lib/mmc.ts against reference M/M/c values\n" + "=".repeat(60));

for (const testCase of cases) {
    const result = calculateMMC(testCase.lambda, testCase.mu, testCase.c);
    console.log(`\n${testCase.label}`);

    (Object.keys(testCase.expected) as Array<keyof typeof testCase.expected>).forEach((key) => {
        const actual = result[key];
        const expected = testCase.expected[key];
        const diff = Math.abs(actual - expected);
        const passed = diff <= testCase.tolerance;
        if (!passed) allPassed = false;
        console.log(
            `  ${passed ? "PASS" : "FAIL"}  ${key.padEnd(4)} expected=${expected.toFixed(4)}  actual=${actual.toFixed(4)}  diff=${diff.toFixed(4)}`
        );
    });
}

console.log("\n" + "=".repeat(60));
if (allPassed) {
    console.log("All reference cases passed. The M/M/c analytical engine is verified correct.");
    process.exit(0);
} else {
    console.log("One or more reference cases FAILED. Check src/lib/mmc.ts.");
    process.exit(1);
}
