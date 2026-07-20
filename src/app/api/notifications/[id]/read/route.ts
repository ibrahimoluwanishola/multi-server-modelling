import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/session";
import { markRead } from "@/lib/server/notification-store";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await requireSession();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const { id } = await params;
    const ok = await markRead(session.userId, id);
    if (!ok) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    return NextResponse.json({ success: true });
}
