// Pixi v8 (WebGL, not WebGPU) — the incumbent, built FAIR for 10k here:
//  - ALL edges in ONE Graphics with two stroke batches (relation/mention),
//    never one display object per line (Pixi's weak point at scale).
//  - ALL nodes are Sprites sharing ONE sphere texture -> Pixi batches them;
//    per-node tint = type color, scale = degree.
//  - Glow = one shared additive halo texture, sprites in a toggled container.
//  - Pan/zoom = a single `world` container transform (Pixi has no camera).
// Layout comes precomputed from the worker; this adapter only renders.
import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { BenchModel } from '../model';
import { BENCH_TYPE_COLORS } from '../model';
import type { AdapterOptions, PositionMap, RendererHandle } from './types';

const NODE_MIN = 3;
const NODE_MAX = 18;
const PADDING = 60;

function makeSphereTexture(app: Application): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  // shiny ball: bright off-center highlight -> mid -> dark rim. White so tint works.
  const g = ctx.createRadialGradient(24, 22, 2, 32, 32, 32);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.45, '#dcdcdc');
  g.addColorStop(1, '#3a3a3a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(32, 32, 31, 0, Math.PI * 2);
  ctx.fill();
  return Texture.from(c);
}

function makeGlowTexture(): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return Texture.from(c);
}

export async function pixiAdapter(
  container: HTMLElement,
  model: BenchModel,
  positions: PositionMap,
  opts: AdapterOptions,
): Promise<RendererHandle> {
  const app = new Application();
  await app.init({
    width: opts.width,
    height: opts.height,
    backgroundAlpha: 0,
    antialias: true,
    preference: 'webgl',
  });
  container.appendChild(app.canvas);

  // normalize positions to fit the viewport
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (const p of positions.values()) {
    if (p.x < xMin) xMin = p.x; if (p.x > xMax) xMax = p.x;
    if (p.y < yMin) yMin = p.y; if (p.y > yMax) yMax = p.y;
  }
  const xr = xMax - xMin || 1;
  const yr = yMax - yMin || 1;
  const scale = Math.min((opts.width - 2 * PADDING) / xr, (opts.height - 2 * PADDING) / yr);
  const cx = (xMin + xMax) / 2;
  const cy = (yMin + yMax) / 2;
  const screen = new Map<string, { sx: number; sy: number }>();
  for (const [id, p] of positions) {
    screen.set(id, {
      sx: (p.x - cx) * scale + opts.width / 2,
      sy: (p.y - cy) * scale + opts.height / 2,
    });
  }

  let maxDeg = 1;
  for (const n of model.nodes) if (n.degree > maxDeg) maxDeg = n.degree;

  const world = new Container();
  app.stage.addChild(world);

  // --- edges: ONE Graphics, two stroke passes (D5) ---
  const edges = new Graphics();
  for (const l of model.links) {
    if (l.kind !== 'relation') continue;
    const a = screen.get(l.source); const b = screen.get(l.target);
    if (a && b) edges.moveTo(a.sx, a.sy).lineTo(b.sx, b.sy);
  }
  edges.stroke({ width: 1.6, color: 0xaeb6c2, alpha: 0.55 });
  for (const l of model.links) {
    if (l.kind !== 'mention') continue;
    const a = screen.get(l.source); const b = screen.get(l.target);
    if (a && b) edges.moveTo(a.sx, a.sy).lineTo(b.sx, b.sy);
  }
  edges.stroke({ width: 0.8, color: 0xff3526, alpha: 0.3 });
  world.addChild(edges);

  // --- glow layer (toggle) ---
  const glowTex = makeGlowTexture();
  const glowLayer = new Container();
  glowLayer.visible = opts.glow;
  world.addChild(glowLayer);

  // --- nodes: shared texture, batched sprites ---
  const sphereTex = makeSphereTexture(app);
  const nodeLayer = new Container();
  world.addChild(nodeLayer);

  for (const n of model.nodes) {
    const s = screen.get(n.id);
    if (!s) continue;
    const t = Math.sqrt(n.degree / maxDeg);
    const r = NODE_MIN + t * (NODE_MAX - NODE_MIN);
    const color = BENCH_TYPE_COLORS[n.type] ?? 0xcccccc;

    const halo = new Sprite(glowTex);
    halo.anchor.set(0.5);
    halo.position.set(s.sx, s.sy);
    halo.width = halo.height = r * 4;
    halo.tint = color;
    halo.blendMode = 'add';
    glowLayer.addChild(halo);

    const sp = new Sprite(sphereTex);
    sp.anchor.set(0.5);
    sp.position.set(s.sx, s.sy);
    sp.width = sp.height = r * 2;
    sp.tint = color;
    nodeLayer.addChild(sp);
  }

  // --- pan/zoom on the world container ---
  let dragging = false;
  let lastX = 0, lastY = 0;
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const rect = app.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const wx = (mx - world.x) / world.scale.x;
    const wy = (my - world.y) / world.scale.y;
    world.scale.set(world.scale.x * factor);
    world.x = mx - wx * world.scale.x;
    world.y = my - wy * world.scale.y;
  };
  const onDown = (e: PointerEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    world.x += e.clientX - lastX;
    world.y += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
  };
  const onUp = () => { dragging = false; };
  app.canvas.addEventListener('wheel', onWheel, { passive: false });
  app.canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);

  app.ticker.add(() => opts.onFrame(performance.now()));

  return {
    glowNote: 'per-node additive halo sprite (cheap, no post-processing)',
    setGlow(on: boolean) { glowLayer.visible = on; },
    resize(w: number, h: number) { app.renderer.resize(w, h); },
    dispose() {
      app.canvas.removeEventListener('wheel', onWheel);
      app.canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      app.destroy({ removeView: true }, true);
    },
  };
}
