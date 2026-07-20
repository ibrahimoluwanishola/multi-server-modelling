"use client";

import { useEffect, useState } from "react";

export interface CurrentSession {
    userId: string;
    name: string;
    role: "admin" | "doctor" | "receptionist";
    departmentId?: string;
}

export function useSession() {
    const [session, setSession] = useState<CurrentSession | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/auth/me")
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (!cancelled) setSession(data);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return { session, loading };
}
