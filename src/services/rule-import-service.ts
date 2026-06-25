import type { DatabaseLike } from './entity-service';

export interface RuleEntity {
  id: string;
  type: string;
  title: string;
  ruleset: string;
  properties?: Record<string, unknown>;
  reference_summary?: string;
  body?: Record<string, unknown>;
}

export interface ImportRulesParams {
  sourceId: string;
  sourceLabel: string;
  license: string;
  url: string;
  rules: RuleEntity[];
}

export function importRules(db: DatabaseLike, params: ImportRulesParams): void {
  db.prepare(
    `INSERT OR REPLACE INTO rule_sources (id, label, license, url, is_read_only) VALUES (?, ?, ?, ?, 1)`,
  ).run(params.sourceId, params.sourceLabel, params.license, params.url);

  for (const rule of params.rules) {
    const existing = db.prepare(
      `SELECT id FROM rule_entities WHERE id = ? AND source_id = ?`,
    ).get(rule.id, params.sourceId) as Record<string, unknown> | undefined;

    if (existing) {
      db.prepare(
        `UPDATE rule_entities SET title = ?, reference_summary = ?, properties_json = ?, body_json = ? WHERE id = ? AND source_id = ?`,
      ).run(
        rule.title,
        rule.reference_summary ?? null,
        JSON.stringify(rule.properties ?? {}),
        JSON.stringify(rule.body ?? {}),
        rule.id,
        params.sourceId,
      );
    } else {
      db.prepare(
        `INSERT INTO rule_entities (id, type, ruleset, title, properties_json, reference_summary, body_json, source_id, is_homebrew)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      ).run(
        rule.id,
        rule.type,
        rule.ruleset,
        rule.title,
        JSON.stringify(rule.properties ?? {}),
        rule.reference_summary ?? null,
        JSON.stringify(rule.body ?? {}),
        params.sourceId,
      );
    }
  }
}

export function createHomebrewRule(
  db: DatabaseLike,
  opts: { type: string; title: string; ruleset: string; properties?: Record<string, unknown>; reference_summary?: string },
): { id: string } {
  const id = `rule-hb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  db.prepare(
    `INSERT INTO rule_entities (id, type, ruleset, title, properties_json, reference_summary, is_homebrew)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
  ).run(id, opts.type, opts.ruleset, opts.title, JSON.stringify(opts.properties ?? {}), opts.reference_summary ?? null);
  return { id };
}

export function createRuleOverride(
  db: DatabaseLike,
  opts: { baseEntityId: string; overrides: Partial<RuleEntity> },
): { id: string } {
  const base = db.prepare(`SELECT * FROM rule_entities WHERE id = ?`).get(opts.baseEntityId) as Record<string, unknown> | undefined;
  const id = `rule-override-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  db.prepare(
    `INSERT INTO rule_entities (id, type, ruleset, title, properties_json, reference_summary, is_homebrew, base_entity_id)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
  ).run(
    id,
    opts.overrides.type ?? (base?.type as string) ?? 'unknown',
    opts.overrides.ruleset ?? (base?.ruleset as string) ?? 'homebrew',
    opts.overrides.title ?? (base?.title as string) ?? '',
    JSON.stringify(opts.overrides.properties ?? JSON.parse((base?.properties_json as string) ?? '{}')),
    opts.overrides.reference_summary ?? (base?.reference_summary as string) ?? null,
    opts.baseEntityId,
  );
  return { id };
}

export function listRuleEntities(
  db: DatabaseLike,
  filter?: { type?: string; tag?: string },
): Record<string, unknown>[] {
  if (filter?.type) {
    return db.prepare(`SELECT * FROM rule_entities WHERE type = ?`).all(filter.type) as Record<string, unknown>[];
  }
  return db.prepare(`SELECT * FROM rule_entities`).all() as Record<string, unknown>[];
}
