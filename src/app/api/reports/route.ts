import { NextResponse } from "next/server";
import { getTodaySummary, listReports } from "@/lib/server/report-store";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId") || undefined;
    const [reports, todaySummary] = await Promise.all([listReports(departmentId), getTodaySummary()]);
    return NextResponse.json({ reports, todaySummary });
}
