import { publishEvent } from "./event-bus";
import { getDepartment } from "./department-store";
import { findUserById, listUsers } from "./user-store";
import { addNotification } from "./notification-store";
import { db, isDatabaseConfigured, memoryTable, setMemoryTable } from "./db";
import { Visit, VisitPriority, VisitStatus } from "@/types/queue";

export type { Visit, VisitPriority, VisitStatus };

/**
 * REAL, event-sourced patient visit log — the single source of truth for
 * every "real data" figure shown on the Dashboard and Reports pages.
 * Persisted to Postgres (table `visits`, see supabase/schema.sql) when a
 * database is configured; in-memory fallback otherwise.
 *
 * It starts genuinely empty either way. Every entry is created by an actual
 * receptionist check-in action in the running app — there is no seeded,
 * synthetic, or placeholder history. Analytics derived from this store are
 * only ever computed once real visits exist; see report-store.ts for how an
 * empty store is handled honestly instead of being padded with invented
 * numbers.
 */

const TABLE = "visits";

interface VisitRow {
    id: string;
    patient_name: string;
    department_id: string;
    department_name: string;
    reason: string;
    priority: VisitPriority;
    status: VisitStatus;
    checked_in_at: string;
    started_at: string | null;
    completed_at: string | null;
    assigned_doctor_id: string | null;
    assigned_doctor_name: string | null;
    checked_in_by: string;
    notes: string | null;
}

function rowToVisit(row: VisitRow): Visit {
    return {
        id: row.id,
        patientName: row.patient_name,
        departmentId: row.department_id,
        departmentName: row.department_name,
        reason: row.reason,
        priority: row.priority,
        status: row.status,
        checkedInAt: row.checked_in_at,
        startedAt: row.started_at ?? undefined,
        completedAt: row.completed_at ?? undefined,
        assignedDoctorId: row.assigned_doctor_id ?? undefined,
        assignedDoctorName: row.assigned_doctor_name ?? undefined,
        checkedInBy: row.checked_in_by,
        notes: row.notes ?? undefined,
    };
}

function visitToRow(v: Visit): VisitRow {
    return {
        id: v.id,
        patient_name: v.patientName,
        department_id: v.departmentId,
        department_name: v.departmentName,
        reason: v.reason,
        priority: v.priority,
        status: v.status,
        checked_in_at: v.checkedInAt,
        started_at: v.startedAt ?? null,
        completed_at: v.completedAt ?? null,
        assigned_doctor_id: v.assignedDoctorId ?? null,
        assigned_doctor_name: v.assignedDoctorName ?? null,
        checked_in_by: v.checkedInBy,
        notes: v.notes ?? null,
    };
}

const priorityRank: Record<VisitPriority, number> = { Emergency: 0, Urgent: 1, Routine: 2 };

async function loadAll(): Promise<Visit[]> {
    if (isDatabaseConfigured && db) {
        const { data, error } = await db.from(TABLE).select("*").order("checked_in_at", { ascending: false });
        if (error) throw new Error(`Failed to load visits: ${error.message}`);
        return (data as VisitRow[]).map(rowToVisit);
    }
    return memoryTable<Visit>(TABLE, () => []);
}

export async function listVisits(filter?: {
    departmentId?: string;
    status?: VisitStatus | VisitStatus[];
}): Promise<Visit[]> {
    let result = await loadAll();
    if (filter?.departmentId) result = result.filter((v) => v.departmentId === filter.departmentId);
    if (filter?.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        result = result.filter((v) => statuses.includes(v.status));
    }
    return [...result].sort((a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime());
}

export async function getWaitingQueue(departmentId: string): Promise<Visit[]> {
    const visits = await listVisits({ departmentId, status: "WAITING" });
    return visits.sort((a, b) => {
        const p = priorityRank[a.priority] - priorityRank[b.priority];
        if (p !== 0) return p;
        return new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime();
    });
}

export async function getVisit(id: string): Promise<Visit | undefined> {
    if (isDatabaseConfigured && db) {
        const { data, error } = await db.from(TABLE).select("*").eq("id", id).maybeSingle();
        if (error) throw new Error(`Failed to load visit: ${error.message}`);
        return data ? rowToVisit(data as VisitRow) : undefined;
    }
    const visits = await loadAll();
    return visits.find((v) => v.id === id);
}

async function insertVisit(visit: Visit): Promise<void> {
    if (isDatabaseConfigured && db) {
        const { error } = await db.from(TABLE).insert(visitToRow(visit));
        if (error) throw new Error(`Failed to save visit: ${error.message}`);
    } else {
        const visits = await loadAll();
        setMemoryTable(TABLE, [visit, ...visits]);
    }
}

async function updateVisitRow(visit: Visit): Promise<void> {
    if (isDatabaseConfigured && db) {
        const { error } = await db.from(TABLE).update(visitToRow(visit)).eq("id", visit.id);
        if (error) throw new Error(`Failed to update visit: ${error.message}`);
    } else {
        const visits = await loadAll();
        setMemoryTable(
            TABLE,
            visits.map((v) => (v.id === visit.id ? visit : v))
        );
    }
}

export async function checkInPatient(input: {
    patientName: string;
    departmentId: string;
    reason: string;
    priority: VisitPriority;
    checkedInBy: string;
}): Promise<Visit> {
    const dept = await getDepartment(input.departmentId);
    if (!dept) throw new Error("Department not found.");

    const visit: Visit = {
        id: `visit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        patientName: input.patientName,
        departmentId: input.departmentId,
        departmentName: dept.name,
        reason: input.reason,
        priority: input.priority,
        status: "WAITING",
        checkedInAt: new Date().toISOString(),
        checkedInBy: input.checkedInBy,
    };
    await insertVisit(visit);

    publishEvent("visit:created", visit);

    // Notify every doctor assigned to this department that a new patient is waiting.
    const allUsers = await listUsers();
    const doctors = allUsers.filter((u) => u.role === "doctor" && u.departmentId === input.departmentId);
    await Promise.all(
        doctors.map((doc) =>
            addNotification({
                userId: doc.id,
                title: `New patient in ${dept.name}`,
                body: `${visit.patientName} (${visit.priority}) — ${visit.reason}`,
                relatedVisitId: visit.id,
            })
        )
    );

    return visit;
}

export async function startConsultation(visitId: string, doctorId: string): Promise<Visit> {
    const visit = await getVisit(visitId);
    if (!visit) throw new Error("Visit not found.");
    if (visit.status !== "WAITING") throw new Error("This patient is not currently waiting.");

    const doctor = await findUserById(doctorId);
    const updated: Visit = {
        ...visit,
        status: "IN_CONSULTATION",
        startedAt: new Date().toISOString(),
        assignedDoctorId: doctorId,
        assignedDoctorName: doctor?.name,
    };
    await updateVisitRow(updated);

    publishEvent("visit:updated", updated);
    return updated;
}

export async function completeConsultation(visitId: string, notes?: string): Promise<Visit> {
    const visit = await getVisit(visitId);
    if (!visit) throw new Error("Visit not found.");
    if (visit.status !== "IN_CONSULTATION") throw new Error("This patient is not currently in consultation.");

    const updated: Visit = {
        ...visit,
        status: "COMPLETED",
        completedAt: new Date().toISOString(),
        notes: notes || visit.notes,
    };
    await updateVisitRow(updated);

    publishEvent("visit:updated", updated);
    return updated;
}

export async function cancelVisit(visitId: string): Promise<Visit> {
    const visit = await getVisit(visitId);
    if (!visit) throw new Error("Visit not found.");

    const updated: Visit = { ...visit, status: "CANCELLED" };
    await updateVisitRow(updated);

    publishEvent("visit:updated", updated);
    return updated;
}
