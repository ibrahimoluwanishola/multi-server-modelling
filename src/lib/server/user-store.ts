import { hashPassword } from "@/lib/auth";
import { SEED_DEPARTMENTS } from "@/lib/hospital-data";
import { getDepartment } from "./department-store";
import { db, isDatabaseConfigured, memoryTable, setMemoryTable } from "./db";

export interface StaffUser {
    id: string;
    name: string;
    username: string;
    passwordHash: string;
    role: "admin" | "doctor" | "receptionist";
    departmentId?: string;
    createdAt: string;
}

export interface PublicStaffUser {
    id: string;
    name: string;
    username: string;
    role: StaffUser["role"];
    departmentId?: string;
    departmentName?: string;
    createdAt: string;
}

const TABLE = "staff_users";

interface StaffUserRow {
    id: string;
    name: string;
    username: string;
    password_hash: string;
    role: StaffUser["role"];
    department_id: string | null;
    created_at: string;
}

function rowToUser(row: StaffUserRow): StaffUser {
    return {
        id: row.id,
        name: row.name,
        username: row.username,
        passwordHash: row.password_hash,
        role: row.role,
        departmentId: row.department_id ?? undefined,
        createdAt: row.created_at,
    };
}

function userToRow(u: StaffUser): StaffUserRow {
    return {
        id: u.id,
        name: u.name,
        username: u.username,
        password_hash: u.passwordHash,
        role: u.role,
        department_id: u.departmentId ?? null,
        created_at: u.createdAt,
    };
}

/**
 * DEFAULT CREDENTIALS (change via the Staff Management page as needed):
 *   admin        / admin123      (role: admin)
 *   dr.adeyemi   / doctor123     (role: doctor, General Outpatient)
 *   reception1   / reception123  (role: receptionist, General Outpatient)
 *
 * Seeded automatically, once, the first time this store is queried against
 * an empty table/collection — whether that's a brand new Postgres database
 * (run supabase/schema.sql first, which creates the table but deliberately
 * leaves it empty of staff — see that file's comment for why) or the
 * in-memory fallback on a freshly started dev server.
 */
function seedUsers(): StaffUser[] {
    return [
        {
            id: "user-admin",
            name: "Admin",
            username: "admin",
            passwordHash: hashPassword("admin123"),
            role: "admin",
            createdAt: new Date().toISOString(),
        },
        {
            id: "user-doctor-1",
            name: "Dr. Adeyemi",
            username: "dr.adeyemi",
            passwordHash: hashPassword("doctor123"),
            role: "doctor",
            departmentId: SEED_DEPARTMENTS[0].id,
            createdAt: new Date().toISOString(),
        },
        {
            id: "user-reception-1",
            name: "Reception Desk 1",
            username: "reception1",
            passwordHash: hashPassword("reception123"),
            role: "receptionist",
            departmentId: SEED_DEPARTMENTS[0].id,
            createdAt: new Date().toISOString(),
        },
    ];
}

async function loadAll(): Promise<StaffUser[]> {
    if (isDatabaseConfigured && db) {
        const { data, error } = await db.from(TABLE).select("*");
        if (error) throw new Error(`Failed to load staff: ${error.message}`);
        if (data.length === 0) {
            const seeded = seedUsers();
            const { error: seedError } = await db.from(TABLE).insert(seeded.map(userToRow));
            if (seedError) throw new Error(`Failed to seed staff accounts: ${seedError.message}`);
            return seeded;
        }
        return (data as StaffUserRow[]).map(rowToUser);
    }
    return memoryTable<StaffUser>(TABLE, seedUsers);
}

async function toPublic(user: StaffUser): Promise<PublicStaffUser> {
    const dept = user.departmentId ? await getDepartment(user.departmentId) : undefined;
    return {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        departmentId: user.departmentId,
        departmentName: dept?.name,
        createdAt: user.createdAt,
    };
}

export async function findUserByUsername(username: string): Promise<StaffUser | undefined> {
    const users = await loadAll();
    return users.find((u) => u.username.toLowerCase() === username.toLowerCase());
}

export async function findUserById(id: string): Promise<StaffUser | undefined> {
    const users = await loadAll();
    return users.find((u) => u.id === id);
}

export async function listUsers(): Promise<PublicStaffUser[]> {
    const users = await loadAll();
    return Promise.all(users.map(toPublic));
}

export async function createUser(input: {
    name: string;
    username: string;
    password: string;
    role: StaffUser["role"];
    departmentId?: string;
}): Promise<PublicStaffUser> {
    const users = await loadAll();
    if (users.some((u) => u.username.toLowerCase() === input.username.toLowerCase())) {
        throw new Error("That username is already taken.");
    }
    const user: StaffUser = {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: input.name,
        username: input.username,
        passwordHash: hashPassword(input.password),
        role: input.role,
        departmentId: input.departmentId,
        createdAt: new Date().toISOString(),
    };

    if (isDatabaseConfigured && db) {
        const { error } = await db.from(TABLE).insert(userToRow(user));
        if (error) throw new Error(`Failed to create staff account: ${error.message}`);
    } else {
        setMemoryTable(TABLE, [...users, user]);
    }
    return toPublic(user);
}

export async function deleteUser(id: string): Promise<boolean> {
    if (id === "user-admin") return false; // protect the seed admin account

    if (isDatabaseConfigured && db) {
        const { error, count } = await db.from(TABLE).delete({ count: "exact" }).eq("id", id);
        if (error) throw new Error(`Failed to delete staff account: ${error.message}`);
        return (count ?? 0) > 0;
    }
    const users = await loadAll();
    const next = users.filter((u) => u.id !== id);
    if (next.length === users.length) return false;
    setMemoryTable(TABLE, next);
    return true;
}

export async function updateUser(
    id: string,
    patch: Partial<Pick<StaffUser, "name" | "departmentId">>
): Promise<PublicStaffUser | undefined> {
    const users = await loadAll();
    const existing = users.find((u) => u.id === id);
    if (!existing) return undefined;

    const updated: StaffUser = { ...existing, ...patch };
    if (updated.departmentId === "") updated.departmentId = undefined;

    if (isDatabaseConfigured && db) {
        const { error } = await db
            .from(TABLE)
            .update({ name: updated.name, department_id: updated.departmentId || null })
            .eq("id", id);
        if (error) throw new Error(`Failed to update staff account: ${error.message}`);
    } else {
        setMemoryTable(
            TABLE,
            users.map((u) => (u.id === id ? updated : u))
        );
    }
    return toPublic(updated);
}
