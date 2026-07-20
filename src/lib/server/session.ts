import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, SessionPayload, verifySessionToken } from "@/lib/auth";

export async function getSession(): Promise<SessionPayload | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    return verifySessionToken(token);
}

export async function requireSession(role?: SessionPayload["role"] | SessionPayload["role"][]) {
    const session = await getSession();
    if (!session) return null;
    if (role) {
        const roles = Array.isArray(role) ? role : [role];
        if (!roles.includes(session.role)) return null;
    }
    return session;
}
