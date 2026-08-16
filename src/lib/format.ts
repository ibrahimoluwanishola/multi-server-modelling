/**
 * Safely formats a number that might arrive as `null` -- which is exactly
 * what happens when an unstable queue (rho >= 1) produces a theoretically
 * infinite wait time: the server correctly computes JavaScript's `Infinity`,
 * but `JSON.stringify()` silently converts `Infinity` to `null` when the
 * API response crosses the network to the browser. Calling `.toFixed()`
 * directly on that `null` throws and crashes the page -- this function
 * exists specifically to make that impossible everywhere it's used.
 *
 * Also guards against the more subtle version of this bug: code that
 * multiplies by 60 before checking (e.g. `(value * 60).toFixed(1)`) doesn't
 * crash when value is null (null * 60 === 0 in JS), but silently displays
 * "0.0 min" for what should be an infinite wait time -- wrong, not just
 * ugly. Both fmtNum and fmtMinutes check for null/non-finite FIRST, before
 * any arithmetic, so this can't happen.
 */
export function fmtNum(value: number | null | undefined, decimals: number = 2): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "\u221e";
    return value.toFixed(decimals);
}

/** Same idea, but for values in hours that get displayed in minutes. */
export function fmtMinutes(hours: number | null | undefined, decimals: number = 1): string {
    if (hours === null || hours === undefined || !Number.isFinite(hours)) return "\u221e";
    return (hours * 60).toFixed(decimals);
}
