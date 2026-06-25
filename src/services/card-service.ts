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

export function listCardTemplates(db: DatabaseLike): CardTemplateRow[] {
  return db.prepare('SELECT id, label, entity_types, size_mm, layout, style FROM card_templates').all() as CardTemplateRow[];
}

export function createCardInstance(
  db: DatabaseLike,
  opts: { entityId: string; templateId: string; audience?: string; fields?: Record<string, unknown> },
): { id: string } {
  const id = `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  db.prepare(
    `INSERT INTO card_instances (id, entity_id, template_id, audience, fields) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, opts.entityId, opts.templateId, opts.audience ?? 'gm', JSON.stringify(opts.fields ?? {}));
  return { id };
}

export function listCardInstances(db: DatabaseLike, filter?: { entityType?: string }): CardInstanceRow[] {
  return db.prepare('SELECT * FROM card_instances').all() as CardInstanceRow[];
}

export interface PrintJob {
  id: string;
  cards: string[];
  cutMarks: boolean;
  backside: string | null;
}

export function savePrintJob(db: DatabaseLike, job: Omit<PrintJob, 'id'>): { id: string } {
  const id = `job-${Date.now()}`;
  db.prepare(
    `INSERT OR REPLACE INTO print_jobs (id, cards_json, cut_marks, backside) VALUES (?, ?, ?, ?)`,
  ).run(id, JSON.stringify(job.cards), job.cutMarks ? 1 : 0, job.backside ?? null);
  return { id };
}

export function loadPrintJob(db: DatabaseLike, id: string): PrintJob | null {
  const row = db.prepare('SELECT * FROM print_jobs WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    cards: JSON.parse(row.cards_json as string) as string[],
    cutMarks: Boolean(row.cut_marks),
    backside: (row.backside as string | null) ?? null,
  };
}

export function updateCardInstance(
  db: DatabaseLike,
  id: string,
  updates: Partial<{ templateId: string; audience: string; fields: Record<string, unknown> }>,
): void {
  if (updates.fields !== undefined) {
    db.prepare('UPDATE card_instances SET fields = ? WHERE id = ?').run(JSON.stringify(updates.fields), id);
  }
  if (updates.templateId !== undefined) {
    db.prepare('UPDATE card_instances SET template_id = ? WHERE id = ?').run(updates.templateId, id);
  }
  if (updates.audience !== undefined) {
    db.prepare('UPDATE card_instances SET audience = ? WHERE id = ?').run(updates.audience, id);
  }
}
