export interface MMCResults {
    rho: number;
    P0: number;
    Lq: number;
    Wq: number;
    L: number;
    W: number;
    stable: boolean;
}

export interface SimulationResult {
    metrics: MMCResults;
    theoretical: MMCResults;
    logs: SimulationLog[];
    simulationTime: number; // in hours
}

export interface SimulationLog {
    time: number;
    event: 'ARRIVAL' | 'DEPARTURE';
    queueLength: number;
    busyServers: number;
}

export interface ConfidenceInterval {
    mean: number;
    marginOfError: number; // half-width of the 95% CI
    low: number;
    high: number;
}

export interface ReplicatedSimulationResult {
    replications: number;
    warmUpHours: number;
    seed: number;
    theoretical: MMCResults;
    rho: ConfidenceInterval;
    Lq: ConfidenceInterval;
    Wq: ConfidenceInterval;
    L: ConfidenceInterval;
    W: ConfidenceInterval;
    sampleLogs: SimulationLog[]; // event log from one representative replication, for charting
    sampleRunLength: number;
}

/**
 * A hospital department modelled as an independent M/M/c queue.
 * c = number of doctors/consultants treated as parallel "servers" in the
 * queueing-theory sense. Nurses assist service delivery but are not modelled
 * as separate servers (a standard simplification for a single-class M/M/c model).
 */
export interface Department {
    id: string;
    name: string;
    category: string;
    description: string;
    lambda: number; // patient arrivals per hour
    mu: number;     // patients served per hour, per doctor
    c: number;      // number of doctors (servers)
    nurseCount: number;
    status: 'Normal' | 'Warning' | 'High Load' | 'Critical';
    createdAt: string;
}

export interface DepartmentWithMetrics extends Department {
    metrics: MMCResults;
}

export interface HospitalReport {
    id: string;
    departmentId: string;
    departmentName: string;
    date: string; // ISO date (day)
    consultationCount: number;
    avgResolutionTimeMinutes: number;
    avgWaitTimeMinutes: number;
    utilization: number;
}

export interface ForecastPoint {
    hour: number; // 0-23
    predictedLambda: number;
    recommendedC: number;
    predictedWqMinutes: number;
}

export interface ForecastResult {
    departmentId: string;
    departmentName: string;
    mu: number;
    targetWqMinutes: number;
    points: ForecastPoint[];
    model: {
        type: string;
        features: string[];
        trainingHours: number;
        rSquared: number;
    };
    sufficientData: boolean;
    dataStatus: {
        visitsRecorded: number;
        distinctDaysRecorded: number;
        distinctHourBucketsRecorded: number;
        visitsNeeded: number;
        daysNeeded: number;
        hourBucketsNeeded: number;
    };
}

export type VisitPriority = "Routine" | "Urgent" | "Emergency";
export type VisitStatus = "WAITING" | "IN_CONSULTATION" | "COMPLETED" | "CANCELLED";

export interface Visit {
    id: string;
    patientName: string;
    departmentId: string;
    departmentName: string;
    reason: string;
    priority: VisitPriority;
    status: VisitStatus;
    checkedInAt: string;
    startedAt?: string;
    completedAt?: string;
    assignedDoctorId?: string;
    assignedDoctorName?: string;
    checkedInBy: string;
    notes?: string;
}

export interface PublicStaffUser {
    id: string;
    name: string;
    username: string;
    role: "admin" | "doctor" | "receptionist";
    departmentId?: string;
    departmentName?: string;
    createdAt: string;
}

export interface AppNotification {
    id: string;
    userId: string;
    title: string;
    body: string;
    relatedVisitId?: string;
    read: boolean;
    createdAt: string;
}
