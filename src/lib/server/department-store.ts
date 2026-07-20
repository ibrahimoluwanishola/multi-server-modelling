import { Department, DepartmentWithMetrics } from "@/types/queue";
import { calculateMMC } from "@/lib/mmc";
import { SEED_DEPARTMENTS } from "@/lib/hospital-data";
import { db, isDatabaseConfigured, memoryTable, setMemoryTable } from "./db";

/**
 * Persistent store for hospital departments. Reads/writes real Postgres
 * rows (table `departments`, see supabase/schema.sql) when a database is
 * configured; otherwise falls back to an in-memory array so local
 * development needs zero setup.
 */

const TABLE = "departments";

interface DepartmentRow {
    id: string;
    name: string;
    category: string;
    description: string;
    lambda: number;
    mu: number;
    c: number;
    nurse_count: number;
    status: Department["status"];
    created_at: string;
}

function rowToDepartment(row: DepartmentRow): Department {
    return {
        id: row.id,
        name: row.name,
        category: row.category,
        description: row.description,
        lambda: Number(row.lambda),
        mu: Number(row.mu),
        c: row.c,
        nurseCount: row.nurse_count,
        status: row.status,
        createdAt: row.created_at,
    };
}

function departmentToRow(d: Department): DepartmentRow {
    return {
        id: d.id,
        name: d.name,
        category: d.category,
        description: d.description,
        lambda: d.lambda,
        mu: d.mu,
        c: d.c,
        nurse_count: d.nurseCount,
        status: d.status,
        created_at: d.createdAt,
    };
}

function deriveStatus(rho: number): Department["status"] {
    if (rho >= 1) return "Critical";
    if (rho >= 0.85) return "High Load";
    if (rho >= 0.7) return "Warning";
    return "Normal";
}

function enrich(dept: Department): DepartmentWithMetrics {
    let metrics;
    try {
        metrics = calculateMMC(dept.lambda, dept.mu, dept.c);
    } catch {
        metrics = { rho: Infinity, P0: 0, Lq: Infinity, Wq: Infinity, L: Infinity, W: Infinity, stable: false };
    }
    return { ...dept, metrics };
}

async function loadAll(): Promise<Department[]> {
    if (isDatabaseConfigured && db) {
        const { data, error } = await db.from(TABLE).select("*").order("created_at", { ascending: false });
        if (error) throw new Error(`Failed to load departments: ${error.message}`);
        return (data as DepartmentRow[]).map(rowToDepartment);
    }
    return memoryTable<Department>(TABLE, () => SEED_DEPARTMENTS.map((d) => ({ ...d })));
}

export async function listDepartments(): Promise<DepartmentWithMetrics[]> {
    const departments = await loadAll();
    return departments.map(enrich);
}

export async function getDepartment(id: string): Promise<DepartmentWithMetrics | undefined> {
    if (isDatabaseConfigured && db) {
        const { data, error } = await db.from(TABLE).select("*").eq("id", id).maybeSingle();
        if (error) throw new Error(`Failed to load department: ${error.message}`);
        return data ? enrich(rowToDepartment(data as DepartmentRow)) : undefined;
    }
    const departments = await loadAll();
    const dept = departments.find((d) => d.id === id);
    return dept ? enrich(dept) : undefined;
}

export async function createDepartment(input: {
    name: string;
    category: string;
    description?: string;
    lambda: number;
    mu: number;
    c: number;
    nurseCount?: number;
}): Promise<DepartmentWithMetrics> {
    const metrics = calculateMMC(input.lambda, input.mu, input.c);
    const dept: Department = {
        id: `dept-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: input.name,
        category: input.category,
        description: input.description ?? "",
        lambda: input.lambda,
        mu: input.mu,
        c: input.c,
        nurseCount: input.nurseCount ?? 0,
        status: deriveStatus(metrics.rho),
        createdAt: new Date().toISOString(),
    };

    if (isDatabaseConfigured && db) {
        const { error } = await db.from(TABLE).insert(departmentToRow(dept));
        if (error) throw new Error(`Failed to create department: ${error.message}`);
    } else {
        const departments = await loadAll();
        setMemoryTable(TABLE, [dept, ...departments]);
    }
    return enrich(dept);
}

export async function updateDepartment(
    id: string,
    patch: Partial<Pick<Department, "name" | "category" | "description" | "lambda" | "mu" | "c" | "nurseCount">>
): Promise<DepartmentWithMetrics | undefined> {
    const existing = await getDepartment(id);
    if (!existing) return undefined;

    const updated: Department = { ...existing, ...patch };
    const metrics = calculateMMC(updated.lambda, updated.mu, updated.c);
    updated.status = deriveStatus(metrics.rho);

    if (isDatabaseConfigured && db) {
        const { error } = await db.from(TABLE).update(departmentToRow(updated)).eq("id", id);
        if (error) throw new Error(`Failed to update department: ${error.message}`);
    } else {
        const departments = await loadAll();
        setMemoryTable(
            TABLE,
            departments.map((d) => (d.id === id ? updated : d))
        );
    }
    return enrich(updated);
}

export async function deleteDepartment(id: string): Promise<boolean> {
    if (isDatabaseConfigured && db) {
        const { error, count } = await db.from(TABLE).delete({ count: "exact" }).eq("id", id);
        if (error) throw new Error(`Failed to delete department: ${error.message}`);
        return (count ?? 0) > 0;
    }
    const departments = await loadAll();
    const next = departments.filter((d) => d.id !== id);
    if (next.length === departments.length) return false;
    setMemoryTable(TABLE, next);
    return true;
}
