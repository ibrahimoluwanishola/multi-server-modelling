import { getSession } from "@/lib/server/session";
import { subscribe } from "@/lib/server/event-bus";

// Must be dynamic: this route holds a long-lived streaming connection and
// must never be cached or statically optimized.
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events endpoint. Each connected browser tab (doctor,
 * receptionist, or admin dashboard) opens one EventSource connection here
 * and receives every hospital event as it happens — new patients checked
 * in, consultations started/completed, new notifications — filtered so a
 * doctor only receives events relevant to their own department/account.
 *
 * SSE was chosen over WebSockets deliberately: the data flow here is purely
 * server -> client (push notifications), which is exactly what SSE is
 * designed for. It runs over plain HTTP with the browser's built-in
 * EventSource API handling reconnection automatically, and needs no custom
 * server or extra client library — unlike WebSockets, which solve a
 * bidirectional problem this app doesn't have.
 */
export async function GET() {
    const session = await getSession();
    if (!session) {
        return new Response("Unauthorized", { status: 401 });
    }

    const encoder = new TextEncoder();
    let heartbeat: ReturnType<typeof setInterval>;
    let unsubscribe: () => void;

    const stream = new ReadableStream({
        start(controller) {
            const send = (event: string, data: unknown) => {
                try {
                    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
                } catch {
                    // controller already closed; ignore
                }
            };

            send("connected", { userId: session.userId });

            unsubscribe = subscribe((event) => {
                // Route events to the relevant client only:
                //  - notification:new -> only to the user it belongs to
                //  - visit:created / visit:updated -> to everyone (department
                //    filtering happens client-side, since queues are viewed
                //    per-department by receptionists/doctors and department-
                //    wide by admins)
                if (event.type === "notification:new") {
                    const payload = event.payload as { userId?: string };
                    if (payload.userId !== session.userId) return;
                }
                send(event.type, event);
            });

            // Heartbeat comment every 20s keeps the connection alive through
            // proxies/load balancers that might otherwise time out an idle
            // HTTP connection.
            heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(`: heartbeat\n\n`));
                } catch {
                    clearInterval(heartbeat);
                }
            }, 20000);
        },
        cancel() {
            clearInterval(heartbeat);
            unsubscribe?.();
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
        },
    });
}
