import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/session";
import { findUserById } from "@/lib/server/user-store";

export async function GET() {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    // The signed session token only carries what's needed to verify identity
    // — it's a snapshot from login time. Mutable profile fields (name, role,
    // department assignment) are re-resolved live here, so an admin
    // reassigning a doctor's department takes effect immediately (next time
    // this endpoint is polled) instead of requiring the doctor to log out
    // and back in for a new token to be issued.
    const current = await findUserById(session.userId);
    if (!current) {
        return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    return NextResponse.json({
        userId: current.id,
        name: current.name,
        role: current.role,
        departmentId: current.departmentId,
        issuedAt: session.issuedAt,
    });
}
