import { HospitalReport } from "@/types/queue";
import { listVisits } from "./visit-store";
import { listDepartments } from "./department-store";

/**
 * Reports are now computed ENTIRELY from the real visit log
 * (src/lib/server/visit-store.ts) — there is no synthetic or seeded history
 * anywhere in this module anymore. If no patients have been checked in yet,
 * this correctly returns an empty list rather than inventing numbers; the
 * Reports page is expected to show an honest "no data yet" state until the
 * Reception page has been used to check patients in.
 */

function minutesBetween(a: string, b: string): number {
    return (new Date(b).getTime() - new Date(a).getTime()) / 60000;
}

export async function listReports(departmentId?: string): Promise<HospitalReport[]> {
    const departments = await listDepartments();
    const allCompleted = await listVisits({ status: "COMPLETED" });
    const completed = allCompleted.filter((v) => !departmentId || v.departmentId === departmentId);

    const byDeptAndDay = new Map<string, { departmentId: string; departmentName: string; date: string; visits: typeof completed }>();

    completed.forEach((visit) => {
        const date = visit.checkedInAt.slice(0, 10);
        const key = `${visit.departmentId}__${date}`;
        const entry = byDeptAndDay.get(key) || {
            departmentId: visit.departmentId,
            departmentName: visit.departmentName,
            date,
            visits: [] as typeof completed,
        };
        entry.visits.push(visit);
        byDeptAndDay.set(key, entry);
    });

    const reports: HospitalReport[] = [];
    byDeptAndDay.forEach(({ departmentId: dId, departmentName, date, visits: dayVisits }) => {
        const dept = departments.find((d) => d.id === dId);
        const waitTimes = dayVisits
            .filter((v) => v.startedAt)
            .map((v) => minutesBetween(v.checkedInAt, v.startedAt!));
        const resolutionTimes = dayVisits
            .filter((v) => v.completedAt)
            .map((v) => minutesBetween(v.checkedInAt, v.completedAt!));

        const avgWait = waitTimes.length ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0;
        const avgResolution = resolutionTimes.length
            ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
            : 0;

        reports.push({
            id: `report-${dId}-${date}`,
            departmentId: dId,
            departmentName,
            date,
            consultationCount: dayVisits.length,
            avgResolutionTimeMinutes: Number(avgResolution.toFixed(1)),
            avgWaitTimeMinutes: Number(avgWait.toFixed(1)),
            utilization: dept ? Number((Math.min(dept.metrics.rho, 1.2) * 100).toFixed(1)) : 0,
        });
    });

    return reports.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Real-time summary of today's actual activity, used on the Dashboard. */
export async function getTodaySummary() {
    const today = new Date().toISOString().slice(0, 10);
    const allVisits = await listVisits();
    const todaysVisits = allVisits.filter((v) => v.checkedInAt.slice(0, 10) === today);
    const completed = todaysVisits.filter((v) => v.status === "COMPLETED");
    const waiting = todaysVisits.filter((v) => v.status === "WAITING");
    const inConsultation = todaysVisits.filter((v) => v.status === "IN_CONSULTATION");

    const waitTimes = completed
        .filter((v) => v.startedAt)
        .map((v) => minutesBetween(v.checkedInAt, v.startedAt!));
    const avgWaitMinutes = waitTimes.length ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0;

    return {
        totalCheckedInToday: todaysVisits.length,
        waitingNow: waiting.length,
        inConsultationNow: inConsultation.length,
        completedToday: completed.length,
        avgWaitMinutesToday: Number(avgWaitMinutes.toFixed(1)),
        hasData: todaysVisits.length > 0,
    };
}
