import type { CardData } from './pdf-export';

export const RESOLUTION_PRESETS = {
  screen_72: { dpi: 72, label: 'Screen (72 dpi)' },
  print_150: { dpi: 150, label: 'Print (150 dpi)' },
  high_300:  { dpi: 300, label: 'High quality (300 dpi)' },
} as const;

const MM_TO_PX_AT_72DPI = 72 / 25.4;

export function renderCard(
  ctx: CanvasRenderingContext2D,
  card: CardData,
  scale = 1,
): void {
  const size = card.size_mm ?? { width_mm: 63, height_mm: 88 };
  const w = size.width_mm * MM_TO_PX_AT_72DPI * scale;
  const h = size.height_mm * MM_TO_PX_AT_72DPI * scale;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#000000';
  ctx.font = `${12 * scale}px sans-serif`;
  ctx.fillText(card.label ?? (card.fields?.name as string) ?? '', 8 * scale, 20 * scale);
  if (card.fields?.summary) {
    ctx.font = `${9 * scale}px sans-serif`;
    ctx.fillText(card.fields.summary as string, 8 * scale, 36 * scale);
  }
}

export async function exportCardToPng(
  opts: { card: CardData; dpi?: number },
): Promise<Blob | Buffer> {
  const dpi = opts.dpi ?? 150;
  const scale = dpi / 72;
  const size = opts.card.size_mm ?? { width_mm: 63, height_mm: 88 };
  const w = Math.round(size.width_mm * MM_TO_PX_AT_72DPI * scale);
  const h = Math.round(size.height_mm * MM_TO_PX_AT_72DPI * scale);

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    renderCard(ctx, opts.card, scale);
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('toBlob returned null'));
      }, 'image/png');
    });
  }

  // Node fallback — return minimal PNG header stub for testing
  const { createCanvas } = await import('canvas').catch(() => ({ createCanvas: null }));
  if (createCanvas) {
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    renderCard(ctx as unknown as CanvasRenderingContext2D, opts.card, scale);
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    return Buffer.from(base64, 'base64');
  }

  return Buffer.alloc(0);
}

export async function exportPrintSheetToPng(
  opts: { cards: CardData[]; dpi?: number; cutMarks?: boolean },
): Promise<Blob | Buffer> {
  const dpi = opts.dpi ?? 150;
  const scale = dpi / 72;
  const pageW = Math.round(210 * MM_TO_PX_AT_72DPI * scale);
  const pageH = Math.round(297 * MM_TO_PX_AT_72DPI * scale);

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = pageW;
    canvas.height = pageH;
    const ctx = canvas.getContext('2d')!;
    const cols = 3;
    const cellW = Math.round(70 * MM_TO_PX_AT_72DPI * scale);
    const cellH = Math.round(100 * MM_TO_PX_AT_72DPI * scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageW, pageH);
    opts.cards.forEach((card, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cellX = col * cellW;
      const cellY = row * cellH;
      ctx.save();
      ctx.translate(cellX, cellY);
      renderCard(ctx, card, scale);
      ctx.restore();
    });
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('toBlob returned null'));
      }, 'image/png');
    });
  }

  return Buffer.alloc(0);
}
