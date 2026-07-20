import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/session";
import { cancelVisit, completeConsultation, getVisit, startConsultation } from "@/lib/server/visit-store";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await requireSession(["doctor", "admin"]);
    if (!session) return NextResponse.json({ error: "Doctor or admin access required." }, { status: 403 });

    const { id } = await params;
    try {
        const { action, notes } = await request.json();

        // Authorization beyond "is this a doctor" — a doctor account should
        // only be able to act on patients in their OWN department, and only
        // complete/cancel consultations THEY started, not another doctor's.
        // Admin bypasses both checks by design (see /doctor page's admin
        // oversight picker) — everyone else must own the department/visit
        // they're modifying, not just guess a visit ID.
        if (session.role !== "admin") {
            const visit = await getVisit(id);
            if (!visit) {
                return NextResponse.json({ error: "Visit not found." }, { status: 404 });
            }
            if (action === "start" && visit.departmentId !== session.departmentId) {
                return NextResponse.json(
                    { error: "You can only manage patients in your own department." },
                    { status: 403 }
                );
            }
            if ((action === "complete" || action === "cancel") && visit.assignedDoctorId !== session.userId) {
                return NextResponse.json(
                    { error: "You can only complete or cancel your own consultations." },
                    { status: 403 }
                );
            }
        }

        let visit;
        if (action === "start") {
            visit = await startConsultation(id, session.userId);
        } else if (action === "complete") {
            visit = await completeConsultation(id, notes);
        } else if (action === "cancel") {
            visit = await cancelVisit(id);
        } else {
            return NextResponse.json({ error: "action must be start, complete, or cancel." }, { status: 400 });
        }
        return NextResponse.json(visit);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
