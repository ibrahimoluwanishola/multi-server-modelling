import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/session";
import { checkInPatient, listVisits, VisitStatus } from "@/lib/server/visit-store";

const VALID_STATUSES: VisitStatus[] = ["WAITING", "IN_CONSULTATION", "COMPLETED", "CANCELLED"];

export async function GET(request: Request) {
    const session = await requireSession();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId") || undefined;
    const statusParam = searchParams.get("status");
    const status = statusParam && VALID_STATUSES.includes(statusParam as VisitStatus) ? (statusParam as VisitStatus) : undefined;
    return NextResponse.json({
        visits: await listVisits({ departmentId, status }),
    });
}

export async function POST(request: Request) {
    const session = await requireSession(["receptionist", "admin"]);
    if (!session) return NextResponse.json({ error: "Receptionist or admin access required." }, { status: 403 });

    try {
        const { patientName, departmentId, reason, priority } = await request.json();
        if (!patientName || !departmentId || !reason || !priority) {
            return NextResponse.json(
                { error: "patientName, departmentId, reason, and priority are required." },
                { status: 400 }
            );
        }
        if (!["Routine", "Urgent", "Emergency"].includes(priority)) {
            return NextResponse.json({ error: "priority must be Routine, Urgent, or Emergency." }, { status: 400 });
        }

        const visit = await checkInPatient({
            patientName,
            departmentId,
            reason,
            priority,
            checkedInBy: session.name,
        });
        return NextResponse.json(visit, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
