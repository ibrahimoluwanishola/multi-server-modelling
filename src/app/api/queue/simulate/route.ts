import { NextResponse } from 'next/server';
import { simulateMMC } from '@/lib/simulation';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { lambda, mu, c, duration = 8, replications = 10, warmUpHours, seed } = body;

        // Validation
        if (typeof lambda !== 'number' || typeof mu !== 'number' || typeof c !== 'number') {
            return NextResponse.json(
                { error: 'Invalid input parameters. lambda, mu, and c must be numbers.' },
                { status: 400 }
            );
        }

        if (lambda < 0 || mu <= 0 || c < 1) {
            return NextResponse.json(
                { error: 'Invalid values. lambda >= 0, mu > 0, c >= 1' },
                { status: 400 }
            );
        }

        // Limit simulation duration to prevent timeouts/abuse
        const safeDuration = Math.min(Math.max(duration, 1), 24);
        const safeReplications = Math.min(Math.max(Number(replications) || 10, 1), 50);

        const result = simulateMMC(lambda, mu, c, safeDuration, {
            replications: safeReplications,
            warmUpHours: typeof warmUpHours === 'number' ? warmUpHours : undefined,
            seed: typeof seed === 'number' ? seed : undefined,
        });
        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
