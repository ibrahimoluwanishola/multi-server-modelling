import { NextResponse } from "next/server";
import { deleteDepartment, updateDepartment } from "@/lib/server/department-store";
import { listVisits } from "@/lib/server/visit-store";
import { requireSession } from "@/lib/server/session";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await requireSession("admin");
    if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

    try {
        const { id } = await params;
        const body = await request.json();
        const updated = await updateDepartment(id, body);
        if (!updated) {
            return NextResponse.json({ error: "Department not found." }, { status: 404 });
        }
        return NextResponse.json(updated);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await requireSession("admin");
    if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

    const { id } = await params;

    // Never allow deleting a department that has any patient visit history —
    // whether from real check-ins or a database's own foreign key
    // constraint (see supabase/schema.sql), losing patient records as a
    // side effect of a department edit is not acceptable. Checked here too
    // (not just left to the database) so this is enforced identically in
    // the in-memory fallback mode, and so the person deleting it gets a
    // clear explanation instead of a raw database error.
    const existingVisits = await listVisits({ departmentId: id });
    if (existingVisits.length > 0) {
        return NextResponse.json(
            {
                error: `Cannot delete this department: ${existingVisits.length} patient visit record(s) reference it. Patient history is never deleted automatically.`,
            },
            { status: 409 }
        );
    }

    const ok = await deleteDepartment(id);
    if (!ok) {
        return NextResponse.json({ error: "Department not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
}
