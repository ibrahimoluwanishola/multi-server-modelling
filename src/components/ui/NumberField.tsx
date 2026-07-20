"use client";

import { useEffect, useState } from "react";

interface NumberFieldProps {
    label?: string;
    value: number;
    onChange: (value: number) => void;
    step?: number;
    min?: number;
    max?: number;
    hint?: string;
    className?: string;
}

/**
 * BUG FIX: the original numeric inputs across this app were plain
 * `<input type="number" value={someNumber} onChange={...Number(e.target.value)}>`.
 * That works for typing into an EMPTY field, but clicking into a field that
 * already has a value (e.g. the default "10") and typing "1" does not
 * replace the existing text — it inserts at the cursor position, so "10"
 * becomes "110" (or "01" depending on cursor position), which is exactly the
 * "typing 1 turns into 01" bug that was reported.
 *
 * Fix: select the entire field's contents on focus, so any value the user
 * had left in the box is immediately replaced by whatever they type next —
 * the standard fix for this exact class of bug in controlled numeric
 * inputs. This component also tracks its own display string while the user
 * is actively typing (so intermediate states like "" or "-" while typing
 * "-5" don't get clobbered by a re-render), and only commits a parsed
 * number back to the parent on blur or on every valid keystroke.
 */
export function NumberField({ label, value, onChange, step, min, max, hint, className }: NumberFieldProps) {
    const [text, setText] = useState(String(value));

    // Keep the field in sync if the parent changes `value` programmatically
    // (e.g. resetting a form), but don't fight the user while they're typing.
    useEffect(() => {
        setText(String(value));
    }, [value]);

    const commit = (raw: string) => {
        const parsed = Number(raw);
        if (raw.trim() !== "" && !Number.isNaN(parsed)) {
            onChange(parsed);
        }
    };

    return (
        <div className={className}>
            {label && <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>}
            <input
                type="number"
                inputMode="decimal"
                step={step}
                min={min}
                max={max}
                value={text}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                    setText(e.target.value);
                    commit(e.target.value);
                }}
                onBlur={(e) => {
                    if (e.target.value.trim() === "" || Number.isNaN(Number(e.target.value))) {
                        setText(String(value));
                    }
                }}
                className="input-field"
            />
            {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
        </div>
    );
}
