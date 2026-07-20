import { NextResponse } from "next/server";
import { trainAndForecast } from "@/lib/ml/forecast";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { departmentId, targetWqMinutes = 20 } = body;
        if (!departmentId) {
            return NextResponse.json({ error: "departmentId is required." }, { status: 400 });
        }
        const result = await trainAndForecast(departmentId, targetWqMinutes);
        if (!result) {
            return NextResponse.json({ error: "Department not found." }, { status: 404 });
        }
        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
