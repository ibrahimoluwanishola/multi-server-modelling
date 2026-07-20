import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/session";
import { listNotifications, markAllRead } from "@/lib/server/notification-store";

export async function GET() {
    const session = await requireSession();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ notifications: await listNotifications(session.userId) });
}

export async function POST() {
    // Marks all of the current user's notifications as read.
    const session = await requireSession();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    await markAllRead(session.userId);
    return NextResponse.json({ success: true });
}
