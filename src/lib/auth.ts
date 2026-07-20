import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "crypto";

/**
 * Lightweight, dependency-free authentication primitives.
 *
 * This project deliberately does NOT pull in an external auth provider
 * (NextAuth, Clerk, WorkOS, etc.) — for an academic system with a handful of
 * seeded staff accounts and no real patient PII at stake, a small,
 * fully-inspectable implementation is more appropriate and more defensible
 * in a report than a black-box dependency. It uses only Node's built-in
 * `crypto` module:
 *
 *   - Passwords are hashed with scrypt (a deliberately slow, memory-hard KDF
 *     designed for password storage) with a random salt per user.
 *   - Sessions are a signed, tamper-evident cookie: payload + HMAC-SHA256
 *     signature using a server-side secret. No session database needed.
 *
 * SECURITY NOTE (documented honestly for the report): this is appropriate
 * for a coursework/demo deployment. A production system handling real
 * patient data would want httpOnly+secure+sameSite cookies (implemented
 * here), a rotate-able secret from a secrets manager, rate limiting on
 * login, and likely a managed auth provider with audit logging.
 */

const SESSION_SECRET =
    process.env.SESSION_SECRET || "mediqueue-optima-dev-secret-change-in-production";

// Must match the cookie's maxAge set in the login route. Enforced here too
// (not just via the cookie's own expiry) because a signed token is valid
// forever as far as HMAC verification alone is concerned — if a token were
// ever copied out of the cookie jar (e.g. into a saved request, a script, a
// browser dev-tools snapshot), it would otherwise still authenticate
// successfully long after a real user would expect their session to have
// expired. Checking `issuedAt` server-side closes that gap.
export const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

export interface SessionPayload {
    userId: string;
    name: string;
    role: "admin" | "doctor" | "receptionist";
    departmentId?: string;
    issuedAt: number;
}

export function hashPassword(password: string): string {
    const salt = randomBytes(16).toString("hex");
    const derived = scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const derived = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
}

function sign(payload: string): string {
    return createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
}

export function createSessionToken(payload: SessionPayload): string {
    const json = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = sign(json);
    return `${json}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
    if (!token) return null;
    const [json, signature] = token.split(".");
    if (!json || !signature) return null;
    const expected = sign(json);
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
    try {
        const parsed = JSON.parse(Buffer.from(json, "base64url").toString("utf-8")) as SessionPayload;
        if (typeof parsed.issuedAt !== "number" || Date.now() - parsed.issuedAt > SESSION_MAX_AGE_MS) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

export const SESSION_COOKIE_NAME = "mqo_session";
