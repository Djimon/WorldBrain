import type { DatabaseLike } from './entity-service';

export interface CardTemplateRow {
  id: string;
  label: string;
  entity_types: string;
  size_mm: string;
  layout?: string;
  style?: string;
}

export interface CardInstanceRow {
  id: string;
  entity_id: string;
  template_id: string;
  audience: string;
  fields: string;
  created_at?: string;
}

export async function listCardTemplates(db: DatabaseLike): Promise<CardTemplateRow[]> {
  return db.select<CardTemplateRow>('SELECT id, label, entity_types, size_mm, layout, style FROM card_templates');
}

export async function createCardInstance(
  db: DatabaseLike,
  opts: { entityId: string; templateId: string; audience?: string; fields?: Record<string, unknown> },
): Promise<{ id: string }> {
  const id = `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await db.execute(
    `INSERT INTO card_instances (id, entity_id, template_id, audience, fields) VALUES (?, ?, ?, ?, ?)`,
    [id, opts.entityId, opts.templateId, opts.audience ?? 'gm', JSON.stringify(opts.fields ?? {})],
  );
  return { id };
}

export async function listCardInstances(db: DatabaseLike, _filter?: { entityType?: string }): Promise<CardInstanceRow[]> {
  return db.select<CardInstanceRow>('SELECT * FROM card_instances');
}

export interface PrintJob {
  id: string;
  cards: string[];
  cutMarks: boolean;
  backside: string | null;
}

export async function savePrintJob(db: DatabaseLike, job: Omit<PrintJob, 'id'>): Promise<{ id: string }> {
  const id = `job-${Date.now()}`;
  await db.execute(
    `INSERT OR REPLACE INTO print_jobs (id, cards_json, cut_marks, backside) VALUES (?, ?, ?, ?)`,
    [id, JSON.stringify(job.cards), job.cutMarks ? 1 : 0, job.backside ?? null],
  );
  return { id };
}

export async function loadPrintJob(db: DatabaseLike, id: string): Promise<PrintJob | null> {
  const rows = await db.select<Record<string, unknown>>('SELECT * FROM print_jobs WHERE id = ?', [id]);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id as string,
    cards: JSON.parse(row.cards_json as string) as string[],
    cutMarks: Boolean(row.cut_marks),
    backside: (row.backside as string | null) ?? null,
  };
}

export async function updateCardInstance(
  db: DatabaseLike,
  id: string,
  updates: Partial<{ templateId: string; audience: string; fields: Record<string, unknown> }>,
): Promise<void> {
  if (updates.fields !== undefined) {
    await db.execute('UPDATE card_instances SET fields = ? WHERE id = ?', [JSON.stringify(updates.fields), id]);
  }
  if (updates.templateId !== undefined) {
    await db.execute('UPDATE card_instances SET template_id = ? WHERE id = ?', [updates.templateId, id]);
  }
  if (updates.audience !== undefined) {
    await db.execute('UPDATE card_instances SET audience = ? WHERE id = ?', [updates.audience, id]);
  }
}
