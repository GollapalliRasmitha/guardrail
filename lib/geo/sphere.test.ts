import { describe, expect, it } from "vitest";
import { arcLift, toXYZ } from "./sphere";

const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 6));

describe("toXYZ: latitude/longitude → a point on a sphere", () => {
  it("puts the equator at longitude 0 on +x, the north pole on +y, 90°E on -z", () => {
    close(toXYZ(0, 0, 1), [1, 0, 0]);
    close(toXYZ(90, 0, 1), [0, 1, 0]);
    close(toXYZ(0, 90, 2), [0, 0, -2]);
  });
});

describe("arcLift: how high an attack's arc rises", () => {
  it("is low for neighbours and higher for the other side of the world, within limits", () => {
    const near = arcLift(toXYZ(1.35, 103.8, 1), toXYZ(13, 100, 1)); // Thailand → Singapore
    const far = arcLift(toXYZ(1.35, 103.8, 1), toXYZ(39, -98, 1)); // USA → Singapore
    expect(near).toBeGreaterThanOrEqual(1.08);
    expect(far).toBeGreaterThan(near);
    expect(far).toBeLessThanOrEqual(1.7);
  });
});
