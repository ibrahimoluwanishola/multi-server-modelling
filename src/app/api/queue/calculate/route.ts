import { NextResponse } from 'next/server';
import { calculateMMC } from '@/lib/mmc';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { lambda, mu, c } = body;

        // Basic validation
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

        const results = calculateMMC(lambda, mu, c);
        return NextResponse.json(results);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
