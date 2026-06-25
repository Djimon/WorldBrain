import type { DatabaseLike } from './entity-service';

export interface MapRow {
  id: string;
  title: string;
  asset_id: string;
  image_width_px: number;
  image_height_px: number;
  calibration_json: string | null;
}

export function getMap(db: DatabaseLike, id: string): MapRow | null {
  const row = db.prepare('SELECT * FROM maps WHERE id = ?').get(id) as Record<string, unknown> | null | undefined;
  if (!row) return null;
  return row as unknown as MapRow;
}

export function listMaps(db: DatabaseLike): MapRow[] {
  return db.prepare('SELECT * FROM maps ORDER BY title ASC').all() as unknown as MapRow[];
}

export function createMap(db: DatabaseLike, opts: { title: string; asset_id?: string; image_width_px?: number; image_height_px?: number }): { id: string } {
  const id = `map-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  db.prepare(
    'INSERT INTO maps (id, title, asset_id, image_width_px, image_height_px) VALUES (?, ?, ?, ?, ?)'
  ).run(id, opts.title, opts.asset_id ?? '', opts.image_width_px ?? 0, opts.image_height_px ?? 0);
  return { id };
}

export function getAssetUrl(assetId: string): string {
  return `/assets/${assetId}`;
}
