/**
 * A still picture of the globe: shown while Three.js loads, and instead of it for people who prefer reduced motion
 * or whose device has no WebGL. Plain SVG drawn with the design tokens.
 */
export function StaticGlobe() {
  const meridians = [-60, -30, 0, 30, 60];
  const parallels = [-60, -30, 0, 30, 60];
  // A few attack arcs into the servers (right of centre) and one high alert hopping to India.
  const arcs = [
    "M60 120 Q170 40 262 238",
    "M90 330 Q170 250 262 238",
    "M180 70 Q240 100 262 238",
    "M330 140 Q310 170 262 238",
  ];
  return (
    <svg viewBox="0 0 400 400" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="80%" stopColor="var(--accent)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="200" r="196" fill="url(#glow)" />
      <circle cx="200" cy="200" r="170" fill="var(--panel)" stroke="var(--line)" strokeWidth="1.5" />
      {meridians.map((m) => (
        <ellipse
          key={`m${m}`}
          cx="200"
          cy="200"
          rx={Math.abs(Math.sin((m * Math.PI) / 180) * 170) || 0.5}
          ry="170"
          fill="none"
          stroke="var(--line)"
        />
      ))}
      {parallels.map((p) => {
        const y = 200 - Math.sin((p * Math.PI) / 180) * 170;
        const r = Math.cos((p * Math.PI) / 180) * 170;
        return <line key={`p${p}`} x1={200 - r} x2={200 + r} y1={y} y2={y} stroke="var(--line)" />;
      })}
      {arcs.map((d) => (
        <path key={d} d={d} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeOpacity="0.75" />
      ))}
      <path d="M262 238 Q245 190 228 205" fill="none" stroke="var(--sev-high)" strokeWidth="1.5" />
      <circle cx="262" cy="238" r="9" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
      <circle cx="262" cy="238" r="4" fill="var(--accent)" />
      <circle cx="228" cy="205" r="3.5" fill="var(--sev-high)" />
    </svg>
  );
}
