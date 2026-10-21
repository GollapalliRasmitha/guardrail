"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { COUNTRY_CENTRES, OWNER, SERVERS } from "@/lib/geo/countries";
import { arcLift, toXYZ, type XYZ } from "@/lib/geo/sphere";
import { ARC_MS, type Attack } from "@/lib/landing/attacks";

// The WebGL globe (loaded only on capable devices that allow motion; see HeroGlobe). Colours come from the design
// tokens, read from CSS at runtime, so there's no raw hex here.

export type GlobePalette = { panel: string; line: string; muted: string; accent: string; high: string };

const FADE_MS = 900; // its trail fades after the hit
const FLASH_MS = 800; // the "blocked" ring
const HOP_MS = 1100; // a high alert travels on to the owner
const POINTS = 64;
const FACING_LON = 82; // turn the globe so South Asia faces the camera

/** A curved arc between two surface points, plus its line object (drawn progressively). */
function makeArc(from: XYZ, to: XYZ, color: string) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(arcLift(from, to));
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(POINTS));
  geometry.setDrawRange(0, 0);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.014, 8, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true }),
  );
  return { curve, line: new THREE.Line(geometry, material), head };
}

/** A ring lying on the globe's surface at a point, used for the "blocked" and "alert received" flashes. */
function makeRing(at: XYZ, color: string) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.6, 1, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.position.set(...at).multiplyScalar(1.004);
  ring.lookAt(new THREE.Vector3(...at).multiplyScalar(2));
  ring.scale.setScalar(0.001);
  return ring;
}

type Live = {
  attack: Attack;
  objects: THREE.Object3D[];
  arc: ReturnType<typeof makeArc>;
  hop: ReturnType<typeof makeArc> | null;
  hit: THREE.Mesh;
  ownerHit: THREE.Mesh | null;
};

const SERVER_XYZ = toXYZ(SERVERS.lat, SERVERS.lon, 1);
const OWNER_XYZ = toXYZ(OWNER.lat, OWNER.lon, 1);
const ease = (t: number) => 1 - (1 - t) ** 3;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/**
 * Moves one attack on by a frame. Returns true when it's finished (and can be removed).
 * 1. it flies to the servers; 2. blocked: a ring flashes there; 3. a high alert hops on to the owner in India.
 */
function animateAttack(l: Live, now: number): boolean {
  const age = now - l.attack.bornAt;
  const p = ease(clamp01(age / ARC_MS));
  l.arc.line.geometry.setDrawRange(0, Math.ceil(p * (POINTS + 1)));
  l.arc.head.position.copy(l.arc.curve.getPoint(p));
  l.arc.head.visible = age < ARC_MS;
  (l.arc.line.material as THREE.LineBasicMaterial).opacity = 0.85 * (1 - clamp01((age - ARC_MS) / FADE_MS));

  const f = clamp01((age - ARC_MS) / FLASH_MS);
  l.hit.scale.setScalar(age < ARC_MS ? 0.001 : 0.02 + f * 0.09);
  (l.hit.material as THREE.MeshBasicMaterial).opacity = age < ARC_MS ? 0 : 1 - f;

  if (!l.hop || !l.ownerHit) return age > ARC_MS + FADE_MS;
  const hopAge = age - ARC_MS - 150;
  const q = ease(clamp01(hopAge / HOP_MS));
  l.hop.line.geometry.setDrawRange(0, hopAge < 0 ? 0 : Math.ceil(q * (POINTS + 1)));
  l.hop.head.position.copy(l.hop.curve.getPoint(q));
  l.hop.head.visible = hopAge > 0 && hopAge < HOP_MS;
  (l.hop.line.material as THREE.LineBasicMaterial).opacity = 0.9 * (1 - clamp01((hopAge - HOP_MS) / FADE_MS));
  const g = clamp01((hopAge - HOP_MS) / FLASH_MS);
  l.ownerHit.scale.setScalar(hopAge < HOP_MS ? 0.001 : 0.02 + g * 0.08);
  (l.ownerHit.material as THREE.MeshBasicMaterial).opacity = hopAge < HOP_MS ? 0 : 1 - g;
  return hopAge > HOP_MS + FADE_MS;
}

/** Draws every attack: grow the arc, flash at the servers (blocked), and for high alerts hop on to India. */
function AttackLayer({ attacks, palette }: { attacks: Attack[]; palette: GlobePalette }) {
  const group = useRef<THREE.Group>(null);
  const live = useRef(new Map<number, Live>());

  useEffect(() => {
    const g = group.current;
    if (!g) return;
    for (const attack of attacks) {
      if (live.current.has(attack.id)) continue;
      const arc = makeArc(toXYZ(attack.lat, attack.lon, 1), SERVER_XYZ, palette.accent);
      const hit = makeRing(SERVER_XYZ, palette.accent);
      const hop = attack.high ? makeArc(SERVER_XYZ, OWNER_XYZ, palette.high) : null;
      const ownerHit = attack.high ? makeRing(OWNER_XYZ, palette.high) : null;
      const objects = [arc.line, arc.head, hit, hop?.line, hop?.head, ownerHit].filter(
        Boolean,
      ) as THREE.Object3D[];
      objects.forEach((o) => g.add(o));
      live.current.set(attack.id, { attack, objects, arc, hop, hit, ownerHit });
    }
  }, [attacks, palette]);

  useEffect(() => {
    const map = live.current;
    return () => map.forEach((l) => dispose(l.objects));
  }, []);

  useFrame(() => {
    const now = performance.now();
    for (const [id, l] of live.current) {
      if (!animateAttack(l, now)) continue;
      l.objects.forEach((o) => group.current?.remove(o));
      dispose(l.objects);
      live.current.delete(id);
    }
  });

  return <group ref={group} />;
}

function dispose(objects: THREE.Object3D[]) {
  for (const o of objects) {
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose();
    (mesh.material as THREE.Material | undefined)?.dispose();
  }
}

/** The globe itself: dark sphere, faint grid, a dot per country, markers for the servers and the owner. */
function Earth({ palette }: { palette: GlobePalette }) {
  const grid = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const add = (lat1: number, lon1: number, lat2: number, lon2: number) =>
      points.push(
        new THREE.Vector3(...toXYZ(lat1, lon1, 1.001)),
        new THREE.Vector3(...toXYZ(lat2, lon2, 1.001)),
      );
    for (let lat = -60; lat <= 60; lat += 30)
      for (let lon = 0; lon < 360; lon += 5) add(lat, lon, lat, lon + 5);
    for (let lon = 0; lon < 360; lon += 30)
      for (let lat = -85; lat < 85; lat += 5) add(lat, lon, lat + 5, lon);
    return new THREE.BufferGeometry().setFromPoints(points);
  }, []);
  const dots = useMemo(
    () =>
      new THREE.BufferGeometry().setFromPoints(
        Object.values(COUNTRY_CENTRES).map(([lat, lon]) => new THREE.Vector3(...toXYZ(lat, lon, 1.003))),
      ),
    [],
  );
  return (
    <>
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial color={palette.panel} />
      </mesh>
      <mesh scale={1.06}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial color={palette.accent} transparent opacity={0.06} side={THREE.BackSide} />
      </mesh>
      <lineSegments geometry={grid}>
        <lineBasicMaterial color={palette.line} transparent opacity={0.9} />
      </lineSegments>
      <points geometry={dots}>
        <pointsMaterial color={palette.muted} size={0.022} sizeAttenuation transparent opacity={0.8} />
      </points>
      <mesh position={toXYZ(SERVERS.lat, SERVERS.lon, 1.01)}>
        <sphereGeometry args={[0.022, 16, 16]} />
        <meshBasicMaterial color={palette.accent} />
      </mesh>
      <mesh position={toXYZ(OWNER.lat, OWNER.lon, 1.01)}>
        <sphereGeometry args={[0.018, 16, 16]} />
        <meshBasicMaterial color={palette.high} />
      </mesh>
    </>
  );
}

/** Slowly sways left and right so the globe feels alive without spinning the servers out of view. */
function Sway({ children }: { children: React.ReactNode }) {
  const spin = useRef<THREE.Group>(null);
  const base = (-(90 + FACING_LON) * Math.PI) / 180;
  useFrame(({ clock }) => {
    if (spin.current) spin.current.rotation.y = base + Math.sin(clock.elapsedTime * 0.12) * 0.4;
  });
  return (
    <group rotation={[0.32, 0, 0]}>
      <group ref={spin} rotation={[0, base, 0]}>
        {children}
      </group>
    </group>
  );
}

export default function Globe({
  attacks,
  palette,
  paused,
}: {
  attacks: Attack[];
  palette: GlobePalette;
  paused: boolean;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 3.7], fov: 40 }}
      dpr={[1, 1.75]} // sharp on phones without rendering 3× the pixels
      frameloop={paused ? "never" : "always"}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
    >
      <Sway>
        <Earth palette={palette} />
        <AttackLayer attacks={attacks} palette={palette} />
      </Sway>
    </Canvas>
  );
}
