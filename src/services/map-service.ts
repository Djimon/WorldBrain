import { copyFile, mkdir } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { DatabaseLike } from './entity-service';

export interface MapRow {
  id: string;
  title: string;
  asset_id: string;
  image_width_px: number;
  image_height_px: number;
  calibration_json: string | null;
}

export async function getMap(db: DatabaseLike, id: string): Promise<MapRow | null> {
  const rows = await db.select<MapRow>('SELECT * FROM maps WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export async function listMaps(db: DatabaseLike): Promise<MapRow[]> {
  return db.select<MapRow>('SELECT * FROM maps ORDER BY title ASC');
}

export async function importMapImage(
  db: DatabaseLike,
  opts: { srcPath: string; title: string; projectDir: string },
): Promise<{ id: string }> {
  const assetsDir = await join(opts.projectDir, 'assets', 'maps');
  await mkdir(assetsDir, { recursive: true });

  const ext = opts.srcPath.split('.').pop() ?? 'png';
  const id = `map-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const destName = `${id}.${ext}`;
  const destPath = await join(assetsDir, destName);
  await copyFile(opts.srcPath, destPath);

  // Get image dimensions via Image element
  const url = convertFileSrc(destPath);
  const { w, h } = await new Promise<{ w: number; h: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 1000, h: 800 });
    img.src = url;
  });

  await db.execute(
    'INSERT INTO maps (id, title, asset_id, image_width_px, image_height_px) VALUES (?, ?, ?, ?, ?)',
    [id, opts.title, destPath, w, h],
  );
  return { id };
}

export async function createMap(db: DatabaseLike, opts: { title: string; asset_id?: string; image_width_px?: number; image_height_px?: number }): Promise<{ id: string }> {
  const id = `map-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await db.execute(
    'INSERT INTO maps (id, title, asset_id, image_width_px, image_height_px) VALUES (?, ?, ?, ?, ?)',
    [id, opts.title, opts.asset_id ?? '', opts.image_width_px ?? 0, opts.image_height_px ?? 0],
  );
  return { id };
}

export async function loadGridSettings(db: DatabaseLike, mapId: string): Promise<Record<string, unknown> | null> {
  const rows = await db.select<{ grid_json: string | null }>('SELECT grid_json FROM maps WHERE id = ?', [mapId]);
  const raw = rows[0]?.grid_json;
  if (!raw) return null;
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return null; }
}

export async function saveGridSettings(db: DatabaseLike, mapId: string, settings: unknown): Promise<void> {
  await db.execute('UPDATE maps SET grid_json = ? WHERE id = ?', [JSON.stringify(settings), mapId]);
}

export function getAssetUrl(assetId: string): string {
  if (assetId && (assetId.startsWith('C:') || assetId.startsWith('/') || assetId.includes('\\'))) {
    return convertFileSrc(assetId);
  }
  return `/assets/${assetId}`;
}
