// M15-S04: Fog-Layer & Paint-Tools — Paint-Oberfläche (#276)
// Renders the fog mask as a <canvas> overlay in the map's CSS-transform
// container, above image layers. Paints via pointer down/move/up in map
// coordinates (PaintInteractionLayer's existing pattern), NOT Leaflet.
// On stroke end, calls onStrokeEnd with the updated mask dataURL — the
// caller (MapViewer) persists it via updateLayer (debounce acceptable).
import { useEffect, useRef } from 'react';
import type { FogToolMode, FogToolShape } from './FogTools';

export interface FogMaskCanvasProps {
  layerId: string;
  maskData: string | null;
  imgW: number;
  imgH: number;
  mode: FogToolMode;
  shape: FogToolShape;
  brushSize: number;
  feather: number;
  active: boolean;
  onStrokeEnd: (maskDataUrl: string) => void;
}

export function FogMaskCanvas({
  layerId, maskData, imgW, imgH, mode, shape, brushSize, feather, active, onStrokeEnd,
}: FogMaskCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  // (Re)load the stored mask onto the canvas whenever it changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!maskData) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.src = maskData;
  }, [maskData, imgW, imgH]);

  function toCanvasCoords(clientX: number, clientY: number): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width ? canvas.width / rect.width : 1;
    const sy = rect.height ? canvas.height / rect.height : 1;
    return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
  }

  function paintOp(ctx: CanvasRenderingContext2D) {
    // reveal = cut alpha (map shows through); cover = add opaque coverage.
    ctx.globalCompositeOperation = mode === 'reveal' ? 'destination-out' : 'source-over';
    ctx.fillStyle = '#000';
  }

  function stampBrush(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    paintOp(ctx);
    if (feather > 0) { ctx.shadowColor = '#000'; ctx.shadowBlur = feather; }
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, brushSize / 2), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function stampRect(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
    ctx.save();
    paintOp(ctx);
    ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    ctx.restore();
  }

  function emit() {
    const canvas = canvasRef.current;
    let out = maskData ?? '';
    // AP-006 exception: mask encode may be unavailable (no canvas backend in
    // headless test env) — fall back to the prior mask string.
    try {
      const d = canvas?.toDataURL('image/png');
      if (d) out = d;
    } catch { /* no-op */ }
    onStrokeEnd(out);
  }

  function handleDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    const p = toCanvasCoords(e.clientX, e.clientY);
    start.current = p;
    const ctx = canvas.getContext('2d');
    if (ctx && shape === 'brush') stampBrush(ctx, p.x, p.y);
    try { canvas.setPointerCapture(e.pointerId); } catch { /* jsdom */ }
  }

  function handleMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!active || !drawing.current) return;
    if (shape !== 'brush') return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const p = toCanvasCoords(e.clientX, e.clientY);
    stampBrush(ctx, p.x, p.y);
  }

  function handleUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!active || !drawing.current) return;
    drawing.current = false;
    const ctx = canvasRef.current?.getContext('2d') ?? null;
    if (ctx && shape === 'rectangle' && start.current) {
      const p = toCanvasCoords(e.clientX, e.clientY);
      stampRect(ctx, start.current.x, start.current.y, p.x, p.y);
    }
    start.current = null;
    emit();
  }

  return (
    <canvas
      ref={canvasRef}
      data-fog-layer-id={layerId}
      width={imgW}
      height={imgH}
      className="fog-mask-canvas"
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: active ? 'auto' : 'none' }}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
    />
  );
}

export default FogMaskCanvas;
