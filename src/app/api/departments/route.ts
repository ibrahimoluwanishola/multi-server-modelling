import { NextResponse } from "next/server";
import { createDepartment, listDepartments } from "@/lib/server/department-store";
import { requireSession } from "@/lib/server/session";

export async function GET() {
    return NextResponse.json({ departments: await listDepartments() });
}

export async function POST(request: Request) {
    const session = await requireSession("admin");
    if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

    try {
        const body = await request.json();
        const { name, category, description, lambda, mu, c, nurseCount } = body;

        if (!name || typeof lambda !== "number" || typeof mu !== "number" || typeof c !== "number") {
            return NextResponse.json(
                { error: "name, lambda, mu, and c are required (lambda/mu/c must be numbers)." },
                { status: 400 }
            );
        }
        if (lambda < 0 || mu <= 0 || c < 1) {
            return NextResponse.json(
                { error: "Invalid values. lambda >= 0, mu > 0, c >= 1." },
                { status: 400 }
            );
        }

        const dept = await createDepartment({
            name,
            category: category || "General",
            description,
            lambda,
            mu,
            c,
            nurseCount,
        });
        return NextResponse.json(dept, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
