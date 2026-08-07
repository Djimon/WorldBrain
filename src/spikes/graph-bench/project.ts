// Manual 3D -> 2D projection so the 2D engines (Pixi/Sigma) can render the
// SAME rotatable 3D galaxy as three.js. This is the actual bench question:
// can a 2D renderer sustain a per-frame CPU reprojection of 3D positions at
// 3k-10k nodes? (StellarGraph does exactly this by hand on Canvas2D.)

export interface P3 { x: number; y: number; z: number; }
export interface Orbit { yaw: number; pitch: number; zoom: number; }

// center + scale positions so the max extent over x/y/z maps to ~[-1, 1].
export function normalize3D(positions: Iterable<[string, P3]>): Map<string, P3> {
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity, zMin = Infinity, zMax = -Infinity;
  const raw: [string, P3][] = [];
  for (const [id, p] of positions) {
    raw.push([id, p]);
    if (p.x < xMin) xMin = p.x; if (p.x > xMax) xMax = p.x;
    if (p.y < yMin) yMin = p.y; if (p.y > yMax) yMax = p.y;
    if (p.z < zMin) zMin = p.z; if (p.z > zMax) zMax = p.z;
  }
  const cx = (xMin + xMax) / 2, cy = (yMin + yMax) / 2, cz = (zMin + zMax) / 2;
  const half = Math.max(xMax - xMin, yMax - yMin, zMax - zMin) / 2 || 1;
  const out = new Map<string, P3>();
  for (const [id, p] of raw) {
    out.set(id, { x: (p.x - cx) / half, y: (p.y - cy) / half, z: (p.z - cz) / half });
  }
  return out;
}

// yaw around Y, then pitch around X. Returns view-space coords.
export function rotate(p: P3, yaw: number, pitch: number): P3 {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const x1 = p.x * cy + p.z * sy;
  const z1 = -p.x * sy + p.z * cy;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const y1 = p.y * cp - z1 * sp;
  const z2 = p.y * sp + z1 * cp;
  return { x: x1, y: y1, z: z2 };
}

// perspective depth factor; z in ~[-1,1], dist>1. Near (z>0) grows, far shrinks.
export function persp(z: number, dist = 3): number {
  return dist / (dist - z);
}

// Attach drag-to-rotate + wheel-to-zoom to an element, mutating `orbit`.
// Returns a detach fn. Zoom clamps to [0.2, 8].
export function attachOrbit(el: HTMLElement, orbit: Orbit): () => void {
  let dragging = false;
  let lastX = 0, lastY = 0;
  const HALF_PI = Math.PI / 2 - 0.01;

  const down = (e: PointerEvent) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    e.stopPropagation();
  };
  const move = (e: PointerEvent) => {
    if (!dragging) return;
    orbit.yaw += (e.clientX - lastX) * 0.008;
    orbit.pitch += (e.clientY - lastY) * 0.008;
    orbit.pitch = Math.max(-HALF_PI, Math.min(HALF_PI, orbit.pitch));
    lastX = e.clientX; lastY = e.clientY;
  };
  const up = () => { dragging = false; };
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    orbit.zoom *= e.deltaY < 0 ? 1.1 : 1 / 1.1;
    orbit.zoom = Math.max(0.2, Math.min(8, orbit.zoom));
  };

  el.addEventListener('pointerdown', down, true);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  el.addEventListener('wheel', wheel, { passive: false });
  return () => {
    el.removeEventListener('pointerdown', down, true);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    el.removeEventListener('wheel', wheel);
  };
}
