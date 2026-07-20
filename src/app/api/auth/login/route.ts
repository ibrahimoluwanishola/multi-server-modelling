import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS, verifyPassword } from "@/lib/auth";
import { findUserByUsername } from "@/lib/server/user-store";

export async function POST(request: Request) {
    try {
        const { username, password } = await request.json();
        if (!username || !password) {
            return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
        }

        const user = await findUserByUsername(username);
        if (!user || !verifyPassword(password, user.passwordHash)) {
            return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
        }

        const token = createSessionToken({
            userId: user.id,
            name: user.name,
            role: user.role,
            departmentId: user.departmentId,
            issuedAt: Date.now(),
        });

        const cookieStore = await cookies();
        cookieStore.set(SESSION_COOKIE_NAME, token, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: SESSION_MAX_AGE_MS / 1000, // cookie maxAge is in seconds
        });

        return NextResponse.json({
            id: user.id,
            name: user.name,
            role: user.role,
            departmentId: user.departmentId,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
