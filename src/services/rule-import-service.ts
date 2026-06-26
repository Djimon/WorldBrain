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

export async function importRules(db: DatabaseLike, params: ImportRulesParams): Promise<void> {
  await db.execute(
    `INSERT OR REPLACE INTO rule_sources (id, label, license, url, is_read_only) VALUES (?, ?, ?, ?, 1)`,
    [params.sourceId, params.sourceLabel, params.license, params.url],
  );

  for (const rule of params.rules) {
    const existing = await db.select<{ id: string }>(
      `SELECT id FROM rule_entities WHERE id = ? AND source_id = ?`,
      [rule.id, params.sourceId],
    );

    if (existing.length > 0) {
      await db.execute(
        `UPDATE rule_entities SET title = ?, reference_summary = ?, properties_json = ?, body_json = ? WHERE id = ? AND source_id = ?`,
        [rule.title, rule.reference_summary ?? null, JSON.stringify(rule.properties ?? {}),
         JSON.stringify(rule.body ?? {}), rule.id, params.sourceId],
      );
    } else {
      await db.execute(
        `INSERT INTO rule_entities (id, type, ruleset, title, properties_json, reference_summary, body_json, source_id, is_homebrew)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [rule.id, rule.type, rule.ruleset, rule.title, JSON.stringify(rule.properties ?? {}),
         rule.reference_summary ?? null, JSON.stringify(rule.body ?? {}), params.sourceId],
      );
    }
  }
}

export async function createHomebrewRule(
  db: DatabaseLike,
  opts: { type: string; title: string; ruleset: string; properties?: Record<string, unknown>; reference_summary?: string },
): Promise<{ id: string }> {
  const id = `rule-hb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await db.execute(
    `INSERT INTO rule_entities (id, type, ruleset, title, properties_json, reference_summary, is_homebrew)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [id, opts.type, opts.ruleset, opts.title, JSON.stringify(opts.properties ?? {}), opts.reference_summary ?? null],
  );
  return { id };
}

export async function createRuleOverride(
  db: DatabaseLike,
  opts: { baseEntityId: string; overrides: Partial<RuleEntity> },
): Promise<{ id: string }> {
  const baseRows = await db.select<Record<string, unknown>>(
    `SELECT * FROM rule_entities WHERE id = ?`,
    [opts.baseEntityId],
  );
  const base = baseRows[0];
  const id = `rule-override-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await db.execute(
    `INSERT INTO rule_entities (id, type, ruleset, title, properties_json, reference_summary, is_homebrew, base_entity_id, source_id)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, 'homebrew')`,
    [
      id,
      opts.overrides.type ?? (base?.type as string) ?? 'unknown',
      opts.overrides.ruleset ?? (base?.ruleset as string) ?? 'homebrew',
      opts.overrides.title ?? (base?.title as string) ?? '',
      JSON.stringify(opts.overrides.properties ?? JSON.parse((base?.properties_json as string) ?? '{}')),
      opts.overrides.reference_summary ?? (base?.reference_summary as string) ?? null,
      opts.baseEntityId,
    ],
  );
  return { id };
}

export async function listRuleEntities(db: DatabaseLike, filter?: { type?: string; tag?: string }): Promise<Record<string, unknown>[]> {
  if (filter?.type) {
    return db.select(`SELECT * FROM rule_entities WHERE type = ?`, [filter.type]);
  }
  if (filter?.tag) {
    return db.select(`SELECT * FROM rule_entities WHERE properties_json LIKE ?`, [`%"${filter.tag}"%`]);
  }
  return db.select(`SELECT * FROM rule_entities`);
}
