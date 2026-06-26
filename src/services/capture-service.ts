import type { DatabaseLike } from './entity-service';

export interface CaptureRow {
  id: string;
  session_id: string;
  type: string;
  raw_text: string;
  status: string;
  links: string[];
}

export interface CreateCaptureParams {
  type: string;
  raw_text: string;
  links?: string[];
}

export async function createCapture(db: DatabaseLike, sessionId: string, params: CreateCaptureParams): Promise<{ id: string }> {
  const id = 'cap_' + crypto.randomUUID();
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO capture_notes (id, session_id, type, raw_text, status, links_json, created_at)
     VALUES (?, ?, ?, ?, 'needs_processing', ?, ?)`,
    [id, sessionId, params.type, params.raw_text, JSON.stringify(params.links ?? []), now],
  );
  return { id };
}

export async function listCaptures(db: DatabaseLike, sessionId: string): Promise<CaptureRow[]> {
  const rows = await db.select<{ id: string; session_id: string; type: string; raw_text: string; status: string; links_json: string }>(
    `SELECT id, session_id, type, raw_text, status, links_json FROM capture_notes WHERE session_id = ? ORDER BY rowid DESC`,
    [sessionId],
  );
  return rows.map((r) => ({
    id: r.id,
    session_id: r.session_id,
    type: r.type,
    raw_text: r.raw_text,
    status: r.status,
    links: (() => { try { return JSON.parse(r.links_json ?? '[]') as string[]; } catch { return []; } })(),
  }));
}

export async function updateCaptureStatus(db: DatabaseLike, id: string, status: string): Promise<void> {
  await db.execute(`UPDATE capture_notes SET status = ? WHERE id = ?`, [status, id]);
}
