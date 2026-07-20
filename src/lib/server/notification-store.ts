import { publishEvent } from "./event-bus";
import { db, isDatabaseConfigured, memoryTable, setMemoryTable } from "./db";

export interface AppNotification {
    id: string;
    userId: string;
    title: string;
    body: string;
    relatedVisitId?: string;
    read: boolean;
    createdAt: string;
}

/**
 * Persisted, per-user notifications (backs the Navbar notification bell).
 * Real-time delivery to an open browser tab happens via the SSE event bus
 * (event-bus.ts, which is intentionally NOT persisted — see its own doc
 * comment); this store is what lets the bell show unread items even if the
 * user wasn't connected at the moment the notification was created, and is
 * the single source of truth for read/unread state. Persisted to Postgres
 * (table `notifications`) when a database is configured, in-memory
 * fallback otherwise.
 */

const TABLE = "notifications";

interface NotificationRow {
    id: string;
    user_id: string;
    title: string;
    body: string;
    related_visit_id: string | null;
    read: boolean;
    created_at: string;
}

function rowToNotification(row: NotificationRow): AppNotification {
    return {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        body: row.body,
        relatedVisitId: row.related_visit_id ?? undefined,
        read: row.read,
        createdAt: row.created_at,
    };
}

function notificationToRow(n: AppNotification): NotificationRow {
    return {
        id: n.id,
        user_id: n.userId,
        title: n.title,
        body: n.body,
        related_visit_id: n.relatedVisitId ?? null,
        read: n.read,
        created_at: n.createdAt,
    };
}

async function loadAll(): Promise<AppNotification[]> {
    if (isDatabaseConfigured && db) {
        const { data, error } = await db.from(TABLE).select("*").order("created_at", { ascending: false });
        if (error) throw new Error(`Failed to load notifications: ${error.message}`);
        return (data as NotificationRow[]).map(rowToNotification);
    }
    return memoryTable<AppNotification>(TABLE, () => []);
}

export async function addNotification(input: {
    userId: string;
    title: string;
    body: string;
    relatedVisitId?: string;
}): Promise<AppNotification> {
    const notification: AppNotification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId: input.userId,
        title: input.title,
        body: input.body,
        relatedVisitId: input.relatedVisitId,
        read: false,
        createdAt: new Date().toISOString(),
    };

    if (isDatabaseConfigured && db) {
        const { error } = await db.from(TABLE).insert(notificationToRow(notification));
        if (error) throw new Error(`Failed to save notification: ${error.message}`);
    } else {
        const notifications = await loadAll();
        setMemoryTable(TABLE, [notification, ...notifications]);
    }

    publishEvent("notification:new", notification);
    return notification;
}

export async function listNotifications(userId: string): Promise<AppNotification[]> {
    const notifications = await loadAll();
    return notifications.filter((n) => n.userId === userId).slice(0, 50);
}

export async function markRead(userId: string, id: string): Promise<boolean> {
    if (isDatabaseConfigured && db) {
        const { error, count } = await db.from(TABLE).update({ read: true }, { count: "exact" }).eq("id", id).eq("user_id", userId);
        if (error) throw new Error(`Failed to mark notification read: ${error.message}`);
        return (count ?? 0) > 0;
    }
    const notifications = await loadAll();
    const idx = notifications.findIndex((n) => n.id === id && n.userId === userId);
    if (idx === -1) return false;
    const next = [...notifications];
    next[idx] = { ...next[idx], read: true };
    setMemoryTable(TABLE, next);
    return true;
}

export async function markAllRead(userId: string): Promise<void> {
    if (isDatabaseConfigured && db) {
        const { error } = await db.from(TABLE).update({ read: true }).eq("user_id", userId);
        if (error) throw new Error(`Failed to mark notifications read: ${error.message}`);
        return;
    }
    const notifications = await loadAll();
    setMemoryTable(
        TABLE,
        notifications.map((n) => (n.userId === userId ? { ...n, read: true } : n))
    );
}
