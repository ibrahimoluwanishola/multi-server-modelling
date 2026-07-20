import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

/**
 * Route protection. Runs on the Node.js runtime before any page renders.
 * (Renamed from the deprecated `middleware.ts` convention to `proxy.ts` per
 * Next.js 16 — see https://nextjs.org/docs/messages/middleware-to-proxy.
 * The old convention still worked but printed a deprecation warning on
 * every build.)
 *
 * Two tiers of access, by design:
 *
 * 1. The analytical toolkit (Simulation, Optimization, ML Forecast,
 *    Validation, About) is PUBLIC. These are stateless calculators and
 *    reports over the case-study data — there's no real patient
 *    information involved, and requiring a login just to try the core
 *    M/M/c objectives is unnecessary friction for demoing/grading the
 *    project. Their supporting API routes (/api/queue/*, /api/ml/forecast,
 *    /api/validation, and a read-only GET on /api/departments so the
 *    Forecast page can list departments) are public for the same reason.
 *
 * 2. The hospital OPERATIONS layer (Dashboard, Reception, Doctor, Admin
 *    Staff, Departments management) requires a login, because it involves
 *    real actions on real (if fictional) patient records and staffing
 *    data. A handful of these are further restricted by role (e.g.
 *    /admin/** is admin-only, /doctor is doctor-only) so a receptionist
 *    account can't navigate straight to the staff-management page by
 *    guessing the URL.
 */

const ROLE_ROUTES: { prefix: string; roles: string[] }[] = [
    { prefix: "/admin", roles: ["admin"] },
    { prefix: "/departments", roles: ["admin"] },
    { prefix: "/doctor", roles: ["doctor", "admin"] },
    { prefix: "/reception", roles: ["receptionist", "admin"] },
];

const PUBLIC_PATHS = ["/", "/login", "/about", "/simulation", "/optimization", "/forecast", "/validation"];

const PUBLIC_API_PREFIXES = ["/api/auth", "/api/queue", "/api/ml/forecast", "/api/validation", "/api/health"];

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const isPublicApi =
        PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p)) ||
        (pathname === "/api/departments" && request.method === "GET");

    if (
        PUBLIC_PATHS.includes(pathname) ||
        pathname.startsWith("/_next") ||
        isPublicApi ||
        pathname.match(/\.(svg|png|jpg|ico|txt)$/)
    ) {
        return NextResponse.next();
    }

    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = verifySessionToken(token);

    // API routes (other than the public ones above) return 401 JSON instead of a redirect.
    if (pathname.startsWith("/api")) {
        if (!session) {
            return NextResponse.json({ error: "Authentication required." }, { status: 401 });
        }
        return NextResponse.next();
    }

    if (!session) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("next", pathname);
        return NextResponse.redirect(loginUrl);
    }

    const restricted = ROLE_ROUTES.find((r) => pathname.startsWith(r.prefix));
    if (restricted && !restricted.roles.includes(session.role)) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
