// Plain maths for the globe (no Three.js, so it's unit-tested).

export type XYZ = [number, number, number];

/** Latitude/longitude in degrees → a point on a sphere of radius r (y is up; longitude 0 faces +x). */
export function toXYZ(lat: number, lon: number, r: number): XYZ {
  const φ = (lat * Math.PI) / 180;
  const λ = (lon * Math.PI) / 180;
  return [r * Math.cos(φ) * Math.cos(λ), r * Math.sin(φ), -r * Math.cos(φ) * Math.sin(λ)];
}

/** How far above the surface (as a radius multiple) the middle of an arc between two surface points rises. */
export function arcLift(a: XYZ, b: XYZ): number {
  const distance = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); // 0 (same place) … 2 (opposite sides)
  return Math.min(1.7, 1.08 + distance * 0.32);
}
