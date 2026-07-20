"use client";

import { useEffect, useState } from "react";

interface TypewriterTextProps {
    text: string;
    className?: string;
    speedMs?: number;
    startDelayMs?: number;
}

/**
 * Types out `text` one character at a time, then leaves a blinking cursor.
 * Kept as its own small client component so the rest of the landing page
 * (page.tsx) can stay a plain server component.
 */
export function TypewriterText({ text, className, speedMs = 35, startDelayMs = 200 }: TypewriterTextProps) {
    const [visibleChars, setVisibleChars] = useState(0);
    const [done, setDone] = useState(false);

    useEffect(() => {
        let i = 0;
        let interval: ReturnType<typeof setInterval>;
        const startTimeout = setTimeout(() => {
            interval = setInterval(() => {
                i += 1;
                setVisibleChars(i);
                if (i >= text.length) {
                    clearInterval(interval);
                    setDone(true);
                }
            }, speedMs);
        }, startDelayMs);

        return () => {
            clearTimeout(startTimeout);
            clearInterval(interval);
        };
    }, [text, speedMs, startDelayMs]);

    return (
        <span className={className}>
            {text.slice(0, visibleChars)}
            <span
                className={`inline-block w-[2px] md:w-[3px] -mb-1 ml-0.5 h-[0.9em] bg-current align-middle ${
                    done ? "animate-pulse" : "opacity-100"
                }`}
                aria-hidden="true"
            />
        </span>
    );
}
