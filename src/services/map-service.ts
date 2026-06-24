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

export function getAssetUrl(assetId: string): string {
  return `/assets/${assetId}`;
}
