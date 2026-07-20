import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/session";
import { deleteUser, updateUser } from "@/lib/server/user-store";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await requireSession("admin");
    if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const updated = await updateUser(id, body);
    if (!updated) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
    return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await requireSession("admin");
    if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

    const { id } = await params;
    const ok = await deleteUser(id);
    if (!ok) return NextResponse.json({ error: "Staff member not found or cannot be deleted." }, { status: 404 });
    return NextResponse.json({ success: true });
}
