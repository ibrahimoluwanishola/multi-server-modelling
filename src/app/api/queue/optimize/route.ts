import { NextResponse } from 'next/server';
import { optimizeServers } from '@/lib/optimization';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { lambda, mu, targetWq, maxC = 20 } = body;

        // Validation
        if (typeof lambda !== 'number' || typeof mu !== 'number' || typeof targetWq !== 'number') {
            return NextResponse.json(
                { error: 'Invalid input parameters. lambda, mu, and targetWq must be numbers.' },
                { status: 400 }
            );
        }

        if (lambda < 0 || mu <= 0 || targetWq <= 0) {
            return NextResponse.json(
                { error: 'Invalid values. lambda >= 0, mu > 0, targetWq > 0' },
                { status: 400 }
            );
        }

        // BUG FIX: maxC was previously passed straight through with no
        // validation at all, which is what allowed a 0-or-negative maxC to
        // reach optimizeServers and (before the fix in lib/optimization.ts)
        // crash the request. Clamp defensively here as well.
        const safeMaxC = typeof maxC === 'number' && Number.isFinite(maxC) ? Math.max(1, Math.floor(maxC)) : 20;

        const result = optimizeServers(lambda, mu, targetWq, safeMaxC);

        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
