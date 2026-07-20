import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/session";
import { createUser, listUsers } from "@/lib/server/user-store";

export async function GET() {
    const session = await requireSession("admin");
    if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    return NextResponse.json({ staff: await listUsers() });
}

export async function POST(request: Request) {
    const session = await requireSession("admin");
    if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

    try {
        const { name, username, password, role, departmentId } = await request.json();
        if (!name || !username || !password || !role) {
            return NextResponse.json({ error: "name, username, password, and role are required." }, { status: 400 });
        }
        if (!["doctor", "receptionist", "admin"].includes(role)) {
            return NextResponse.json({ error: "role must be doctor, receptionist, or admin." }, { status: 400 });
        }
        if (password.length < 6) {
            return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
        }
        const user = await createUser({ name, username, password, role, departmentId });
        return NextResponse.json(user, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
