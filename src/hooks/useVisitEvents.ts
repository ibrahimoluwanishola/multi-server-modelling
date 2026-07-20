"use client";

import { useEffect } from "react";

export function useVisitEvents(onEvent: () => void) {
    useEffect(() => {
        const source = new EventSource("/api/events/stream");
        source.addEventListener("visit:created", () => onEvent());
        source.addEventListener("visit:updated", () => onEvent());
        return () => source.close();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}
