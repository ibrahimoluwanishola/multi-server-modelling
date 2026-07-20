"use client";

import { useEffect, useRef, useState } from "react";
import { AppNotification } from "@/types/queue";

/**
 * Subscribes to the SSE stream (/api/events/stream) for real-time push, and
 * keeps an in-memory list of notifications for the current user in sync,
 * seeded from the persisted list on mount. EventSource handles automatic
 * reconnection on its own if the connection drops.
 */
export function useNotifications(enabled: boolean) {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [connected, setConnected] = useState(false);
    const sourceRef = useRef<EventSource | null>(null);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;

        fetch("/api/notifications")
            .then((res) => (res.ok ? res.json() : { notifications: [] }))
            .then((data) => {
                if (!cancelled) setNotifications(data.notifications || []);
            });

        const source = new EventSource("/api/events/stream");
        sourceRef.current = source;

        source.addEventListener("connected", () => setConnected(true));
        source.addEventListener("notification:new", (e: MessageEvent) => {
            const event = JSON.parse(e.data);
            setNotifications((prev) => [event.payload, ...prev]);
        });
        source.onerror = () => setConnected(false);
        source.onopen = () => setConnected(true);

        return () => {
            cancelled = true;
            source.close();
        };
    }, [enabled]);

    const unreadCount = notifications.filter((n) => !n.read).length;

    const markAllRead = async () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        await fetch("/api/notifications", { method: "POST" });
    };

    return { notifications, unreadCount, connected, markAllRead };
}
