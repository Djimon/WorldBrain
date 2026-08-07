// Pixi v8 (WebGL) rendering a ROTATABLE 3D galaxy via manual per-frame
// projection (the bench's real question: can a 2D engine sustain CPU
// reprojection of 3D positions at 10k?). Drag = orbit, wheel = zoom.
//  - nodes: Sprites sharing ONE sphere texture, reprojected every frame,
//    depth-sorted + depth-scaled.
//  - edges: ONE Graphics, cleared + rebuilt every frame (2 stroke batches).
//    This is the honest hot path — 3-5x node count line segments per frame.
import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { BenchModel } from '../model';
import { BENCH_TYPE_COLORS } from '../model';
import { normalize3D, rotate, persp, attachOrbit } from '../project';
import type { P3, Orbit } from '../project';
import type { AdapterOptions, PositionMap, RendererHandle } from './types';

const NODE_MIN = 3;
const NODE_MAX = 18;

function makeSphereTexture(): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(24, 22, 2, 32, 32, 32);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.45, '#dcdcdc');
  g.addColorStop(1, '#3a3a3a');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(32, 32, 31, 0, Math.PI * 2); ctx.fill();
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
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
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
    width: opts.width, height: opts.height,
    backgroundAlpha: 0, antialias: true, preference: 'webgl',
  });
  container.appendChild(app.canvas);

  const norm = normalize3D(positions);
  let maxDeg = 1;
  for (const n of model.nodes) if (n.degree > maxDeg) maxDeg = n.degree;

  const orbit: Orbit = { yaw: 0.6, pitch: 0.3, zoom: 1 };
  const detachOrbit = attachOrbit(app.canvas, orbit);

  const world = new Container();
  app.stage.addChild(world);

  const edges = new Graphics();
  world.addChild(edges);

  const glowTex = makeGlowTexture();
  const glowLayer = new Container();
  glowLayer.visible = opts.glow;
  world.addChild(glowLayer);

  const sphereTex = makeSphereTexture();
  const nodeLayer = new Container();
  nodeLayer.sortableChildren = true;
  world.addChild(nodeLayer);

  // per-node draw state, reused each frame
  interface NodeSprite { sp: Sprite; halo: Sprite; baseR: number; np: P3; }
  const nodeSprites: NodeSprite[] = [];
  const projById = new Map<string, { sx: number; sy: number }>();

  for (const n of model.nodes) {
    const np = norm.get(n.id);
    if (!np) continue;
    const t = Math.sqrt(n.degree / maxDeg);
    const baseR = NODE_MIN + t * (NODE_MAX - NODE_MIN);
    const color = BENCH_TYPE_COLORS[n.type] ?? 0xcccccc;

    const halo = new Sprite(glowTex);
    halo.anchor.set(0.5); halo.tint = color; halo.blendMode = 'add';
    glowLayer.addChild(halo);

    const sp = new Sprite(sphereTex);
    sp.anchor.set(0.5); sp.tint = color;
    nodeLayer.addChild(sp);

    nodeSprites.push({ sp, halo, baseR, np });
  }

  function project() {
    const w = app.renderer.width, h = app.renderer.height;
    const S = Math.min(w, h) * 0.42 * orbit.zoom;
    const cx = w / 2, cy = h / 2;

    projById.clear();
    for (let i = 0; i < model.nodes.length; i++) {
      const ns = nodeSprites[i];
      const r = rotate(ns.np, orbit.yaw, orbit.pitch);
      const f = persp(r.z);
      const sx = r.x * f * S + cx;
      const sy = r.y * f * S + cy;
      ns.sp.position.set(sx, sy);
      ns.sp.width = ns.sp.height = ns.baseR * 2 * f;
      ns.sp.zIndex = r.z;
      ns.halo.position.set(sx, sy);
      ns.halo.width = ns.halo.height = ns.baseR * 4 * f;
      projById.set(model.nodes[i].id, { sx, sy });
    }

    // edges rebuilt from scratch — the hot path we're measuring
    edges.clear();
    for (const l of model.links) {
      if (l.kind !== 'relation') continue;
      const a = projById.get(l.source), b = projById.get(l.target);
      if (a && b) edges.moveTo(a.sx, a.sy).lineTo(b.sx, b.sy);
    }
    edges.stroke({ width: 1.4, color: 0xaeb6c2, alpha: 0.5 });
    for (const l of model.links) {
      if (l.kind !== 'mention') continue;
      const a = projById.get(l.source), b = projById.get(l.target);
      if (a && b) edges.moveTo(a.sx, a.sy).lineTo(b.sx, b.sy);
    }
    edges.stroke({ width: 0.7, color: 0xff3526, alpha: 0.28 });
  }

  app.ticker.add(() => {
    project();
    opts.onFrame(performance.now());
  });

  return {
    glowNote: 'per-node additive halo sprite (cheap); reprojection is CPU-bound',
    setGlow(on: boolean) { glowLayer.visible = on; },
    resize(w: number, h: number) { app.renderer.resize(w, h); },
    dispose() {
      detachOrbit();
      app.destroy({ removeView: true }, true);
    },
  };
}
