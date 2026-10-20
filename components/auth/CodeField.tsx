"use client";

/** The 6-digit code box. `one-time-code` lets phones and password managers fill it in. */
export function CodeField({
  value,
  onChange,
  invalid,
  describedBy,
}: {
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  describedBy?: string;
}) {
  return (
    <div>
      <label htmlFor="code" className="mb-1.5 block text-sm font-medium">
        6-digit code
      </label>
      <input
        id="code"
        name="code"
        className="input text-center font-mono text-2xl tracking-[0.5em]"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]*"
        maxLength={7}
        required
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d ]/g, ""))}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      />
    </div>
  );
}
