import { EventEmitter } from "events";

/**
 * In-process event bus for real-time push notifications via Server-Sent
 * Events (SSE). Chosen over WebSockets deliberately: this app's real-time
 * needs are one-directional (server -> client push of "a new patient is
 * waiting", "a patient was called in"), which is exactly what SSE is for —
 * it runs over plain HTTP (no custom server, no extra client library,
 * built-in browser reconnection via EventSource) whereas WebSockets solve a
 * bidirectional-chat problem this app doesn't have.
 *
 * Because this app runs as a single Node process with an in-memory data
 * layer (see src/lib/server/*-store.ts), a plain Node EventEmitter is a
 * correct and sufficient pub-sub backbone. A multi-instance production
 * deployment would swap this for Redis pub/sub (or a hosted realtime
 * service) without changing any calling code, since callers only see
 * `publishEvent` / `subscribe`.
 */

export type HospitalEventType =
    | "visit:created"
    | "visit:updated"
    | "notification:new";

export interface HospitalEvent<T = unknown> {
    type: HospitalEventType;
    payload: T;
    timestamp: string;
}

class HospitalEventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(200); // generous ceiling for many concurrent SSE connections
    }
}

const globalForEventBus = globalThis as unknown as { __hospitalEventBus?: HospitalEventBus };

// Reuse a single instance across Next.js dev-mode hot reloads.
export const eventBus = globalForEventBus.__hospitalEventBus ?? new HospitalEventBus();
globalForEventBus.__hospitalEventBus = eventBus;

export function publishEvent<T>(type: HospitalEventType, payload: T) {
    const event: HospitalEvent<T> = { type, payload, timestamp: new Date().toISOString() };
    eventBus.emit("event", event);
    return event;
}

export function subscribe(listener: (event: HospitalEvent) => void) {
    eventBus.on("event", listener);
    return () => eventBus.off("event", listener);
}
