import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client, using the SERVICE ROLE key (never the anon
 * key, and never imported into any client component). The service role key
 * bypasses Row Level Security by design - that's intentional here, because
 * every table has RLS enabled with zero permissive policies (see
 * supabase/schema.sql): the database is meant to be reachable ONLY through
 * this app's own authenticated, server-side API routes, not directly from
 * a browser. This file must never be imported from a "use client" component.
 *
 * DUAL-MODE BY DESIGN, same philosophy as the rest of this project's data
 * layer: if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY aren't set (the
 * default for local development with no setup), every store falls back to
 * an in-process Map so `npm run dev` still works with zero configuration.
 * Set both to get real, durable Postgres storage - see README section 14.
 */

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isDatabaseConfigured = Boolean(supabaseUrl && serviceRoleKey);

export const db: SupabaseClient | null = isDatabaseConfigured
    ? createClient(supabaseUrl as string, serviceRoleKey as string, {
          auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

// In-memory fallback, one array per named table. Kept on `globalThis` so it
// survives Next.js dev-mode hot reloads the same way module-level `let`
// state used to.
const globalForMemoryStore = globalThis as unknown as { __mediqueueMemoryTables?: Map<string, unknown[]> };
export const memoryTables = globalForMemoryStore.__mediqueueMemoryTables ?? new Map<string, unknown[]>();
globalForMemoryStore.__mediqueueMemoryTables = memoryTables;

export function memoryTable<T>(name: string, seedFactory?: () => T[]): T[] {
    if (!memoryTables.has(name)) {
        memoryTables.set(name, seedFactory ? seedFactory() : []);
    }
    return memoryTables.get(name) as T[];
}

export function setMemoryTable<T>(name: string, rows: T[]): void {
    memoryTables.set(name, rows);
}
