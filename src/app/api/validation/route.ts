import { NextResponse } from "next/server";
import { runValidationSweep } from "@/lib/validation";

// This sweep runs 10 configurations x 15 replications x 12 simulated hours
// of discrete-event simulation, so it takes a moment — that's expected and
// is why it's a GET the page calls once, not something run on every keystroke.
export async function GET() {
    const summary = runValidationSweep();
    return NextResponse.json(summary);
}
