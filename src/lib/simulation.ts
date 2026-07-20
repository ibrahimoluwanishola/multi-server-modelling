import { MMCResults, ReplicatedSimulationResult, SimulationLog } from "@/types/queue";
import { calculateMMC } from "./mmc";
import { mulberry32, sampleExponential } from "./random";

interface SimEvent {
    time: number;
    type: "ARRIVAL" | "DEPARTURE";
}

/**
 * Minimal binary min-heap keyed on event time.
 *
 * The original implementation called `Array.sort()` on the entire pending
 * event list on every single iteration of the simulation loop, which is
 * O(n log n) per event instead of O(log n). For the small, short runs this
 * project needs it never actually crashed, but it is the wrong data
 * structure for a discrete-event simulation and would not scale to longer
 * horizons or busier departments. A binary heap is the standard textbook
 * choice for a simulation's future-event list.
 */
class EventHeap {
    private items: SimEvent[] = [];

    get size() {
        return this.items.length;
    }

    push(event: SimEvent) {
        this.items.push(event);
        let i = this.items.length - 1;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (this.items[parent].time <= this.items[i].time) break;
            [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
            i = parent;
        }
    }

    pop(): SimEvent | undefined {
        if (this.items.length === 0) return undefined;
        const top = this.items[0];
        const last = this.items.pop()!;
        if (this.items.length > 0) {
            this.items[0] = last;
            let i = 0;
            const n = this.items.length;
            while (true) {
                const left = 2 * i + 1;
                const right = 2 * i + 2;
                let smallest = i;
                if (left < n && this.items[left].time < this.items[smallest].time) smallest = left;
                if (right < n && this.items[right].time < this.items[smallest].time) smallest = right;
                if (smallest === i) break;
                [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
                i = smallest;
            }
        }
        return top;
    }
}

interface SingleRunResult {
    rho: number;
    Lq: number;
    Wq: number;
    L: number;
    W: number;
    logs: SimulationLog[];
    endTime: number;
}

/**
 * Runs a single M/M/c discrete-event replication.
 *
 * @param warmUpHours Statistics (area-under-curve accumulators) only start
 *   accumulating after this point, so the simulation doesn't understate
 *   queueing purely because it started from an empty system (a standard
 *   "initial transient bias" concern in discrete-event simulation).
 */
function runSingleReplication(
    lambda: number,
    mu: number,
    c: number,
    duration: number,
    warmUpHours: number,
    rng: () => number
): SingleRunResult {
    const heap = new EventHeap();
    let queueLength = 0;
    let busyServers = 0;
    let lastEventTime = 0;
    let departuresInWindow = 0;
    let areaUnderQ = 0;
    let areaUnderS = 0;
    const logs: SimulationLog[] = [];
    const measuredDuration = Math.max(duration - warmUpHours, 1e-9);

    heap.push({ time: sampleExponential(lambda, rng), type: "ARRIVAL" });

    while (heap.size > 0) {
        const event = heap.pop()!;

        // Accumulate time-weighted stats only for the portion of this
        // interval that falls inside the fixed observation window
        // [warmUpHours, duration]. Earlier versions of this function let
        // the simulation keep running past `duration` until every queued
        // patient had been served, and counted that whole draining tail
        // towards the averages. That systematically UNDERSTATES Lq/Wq —
        // worse the busier the system is — because a queue that is only
        // ever draining (no more arrivals) spends the entire tail below
        // its true steady-state length. Clipping to a fixed window is the
        // standard fixed-horizon discrete-event simulation approach and
        // is what makes the numbers comparable to the analytical steady-
        // state prediction at all.
        const intervalStart = Math.max(lastEventTime, warmUpHours);
        const intervalEnd = Math.min(Math.max(event.time, intervalStart), duration);
        const delta = Math.max(intervalEnd - intervalStart, 0);
        if (delta > 0) {
            areaUnderQ += queueLength * delta;
            areaUnderS += busyServers * delta;
        }
        lastEventTime = Math.min(event.time, duration);

        if (event.time >= duration) {
            // Nothing beyond the observation window can change the
            // statistics above, so there's no reason to keep simulating a
            // potentially long drain-to-empty tail (especially near ρ=1).
            break;
        }

        if (event.type === "ARRIVAL") {
            if (busyServers < c) {
                busyServers++;
                heap.push({ type: "DEPARTURE", time: event.time + sampleExponential(mu, rng) });
            } else {
                queueLength++;
            }
            heap.push({ time: event.time + sampleExponential(lambda, rng), type: "ARRIVAL" });
        } else {
            if (event.time > warmUpHours) departuresInWindow++;

            if (queueLength > 0) {
                queueLength--;
                heap.push({ type: "DEPARTURE", time: event.time + sampleExponential(mu, rng) });
            } else {
                busyServers--;
            }
        }

        logs.push({ time: event.time, event: event.type, queueLength, busyServers });
    }

    const Lq = areaUnderQ / measuredDuration;
    const rho = areaUnderS / measuredDuration / c;
    const effectiveLambda = departuresInWindow / measuredDuration;
    const Wq = effectiveLambda > 0 ? Lq / effectiveLambda : 0;
    const L = Lq + areaUnderS / measuredDuration;
    const W = effectiveLambda > 0 ? L / effectiveLambda : 0;

    return { rho, Lq, Wq, L, W, logs, endTime: duration };
}

function summarize(samples: number[]) {
    const n = samples.length;
    const mean = samples.reduce((a, b) => a + b, 0) / n;
    if (n < 2) {
        return { mean, marginOfError: 0, low: mean, high: mean };
    }
    const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
    const stdErr = Math.sqrt(variance / n);
    // Approximate 95% CI using a t-value (1.96 for large n; wider for small n,
    // via a lookup of common t-table values for low degrees of freedom).
    const tTable = [12.71, 4.3, 3.18, 2.78, 2.57, 2.45, 2.36, 2.31, 2.26, 2.23];
    const tValue = n >= 30 ? 1.96 : tTable[Math.min(n - 2, tTable.length - 1)] ?? 1.96;
    const marginOfError = tValue * stdErr;
    return { mean, marginOfError, low: mean - marginOfError, high: mean + marginOfError };
}

/**
 * Runs the M/M/c queue simulation with multiple independent replications so
 * results carry a 95% confidence interval instead of a single noisy sample
 * path, plus a configurable warm-up period to remove initial-transient bias.
 */
export function simulateMMC(
    lambda: number,
    mu: number,
    c: number,
    duration: number,
    options?: { replications?: number; warmUpHours?: number; seed?: number }
): ReplicatedSimulationResult {
    const replications = Math.min(Math.max(options?.replications ?? 10, 1), 50);
    // Warm-up scales with duration rather than a fixed 1-hour cap: a
    // near-saturated system (ρ close to 1) can take much longer than an
    // hour to leave its empty-start transient, and a fixed short cap left
    // exactly that bias in the reported Lq/Wq for busy configurations.
    const warmUpHours = Math.min(options?.warmUpHours ?? duration * 0.15, duration * 0.5);
    const seed = options?.seed ?? 12345;
    const rng = mulberry32(seed);

    const rhoSamples: number[] = [];
    const LqSamples: number[] = [];
    const WqSamples: number[] = [];
    const LSamples: number[] = [];
    const WSamples: number[] = [];
    let sampleLogs: SimulationLog[] = [];
    let sampleRunLength = 0;

    for (let i = 0; i < replications; i++) {
        const result = runSingleReplication(lambda, mu, c, duration, warmUpHours, rng);
        rhoSamples.push(result.rho);
        LqSamples.push(result.Lq);
        WqSamples.push(result.Wq);
        LSamples.push(result.L);
        WSamples.push(result.W);
        if (i === 0) {
            sampleLogs = result.logs;
            sampleRunLength = result.endTime;
        }
    }

    let theoretical: MMCResults;
    try {
        theoretical = calculateMMC(lambda, mu, c);
    } catch {
        theoretical = { rho: 0, P0: 0, Lq: 0, Wq: 0, L: 0, W: 0, stable: false };
    }

    return {
        replications,
        warmUpHours,
        seed,
        theoretical,
        rho: summarize(rhoSamples),
        Lq: summarize(LqSamples),
        Wq: summarize(WqSamples),
        L: summarize(LSamples),
        W: summarize(WSamples),
        sampleLogs,
        sampleRunLength,
    };
}
