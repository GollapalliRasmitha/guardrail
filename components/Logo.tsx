/** GuardRail mark: a shield crossed by two rails. Decorative unless a label is given. */
export function LogoMark({ className = "size-7", label }: { className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path
        d="M16 2.5 27 6.6v8.2c0 7.1-4.6 12.4-11 14.7C9.6 27.2 5 21.9 5 14.8V6.6L16 2.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9.5 13.2h13M9.5 18.6h13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16" cy="13.2" r="1.9" fill="var(--ground)" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-text">
      <LogoMark className={size === "lg" ? "size-9 text-accent" : "size-7 text-accent"} />
      <span className={`font-display font-semibold tracking-wide ${size === "lg" ? "text-2xl" : "text-lg"}`}>
        Guard<span className="text-accent">Rail</span>
      </span>
    </span>
  );
}
