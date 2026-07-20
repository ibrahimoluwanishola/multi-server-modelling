import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/server/db";

/**
 * Public, unauthenticated diagnostic endpoint. Deliberately reveals no
 * secrets (not the credentials, not even which provider) — just whether a
 * durable Postgres database is actually wired up, since that's the single
 * most useful thing to check right after a deployment: did the environment
 * variables actually get picked up before you start testing the app and
 * wondering why data isn't sticking around.
 */
export async function GET() {
    return NextResponse.json({
        status: "ok",
        storage: isDatabaseConfigured ? "persistent (Postgres/Supabase)" : "in-memory (resets on cold start / restart)",
    });
}
