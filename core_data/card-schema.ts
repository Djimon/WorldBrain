import type { DatabaseSync } from 'node:sqlite';

// --- Types ---

export interface CardSlot {
  field: string;
  max_lines?: number;
  overflow: OverflowPolicy;
}

export interface CardTemplate {
  id: string;
  label: string;
  entity_types: string[];
  size_mm: { width_mm: number; height_mm: number };
  layout: { slots: CardSlot[] };
  style: Record<string, unknown>;
}

// --- Card Sizes ---

export const CARD_SIZES: Record<string, { width_mm: number; height_mm: number }> = {
  Poker:      { width_mm: 63,  height_mm: 88  },
  Tarot:      { width_mm: 70,  height_mm: 120 },
  Moderation: { width_mm: 105, height_mm: 148 },
  A4:         { width_mm: 210, height_mm: 297 },
};

// --- Overflow Policies ---

export const OVERFLOW_POLICIES = {
  TRUNCATE:         'truncate',
  SHRINK:           'shrink',
  SPLIT:            'split',
  SUMMARY_REQUIRED: 'summary_required',
  REFERENCE_ONLY:   'reference_only',
} as const;

export type OverflowPolicy = typeof OVERFLOW_POLICIES[keyof typeof OVERFLOW_POLICIES];

// --- Categories requiring reference_summary ---

const REFERENCE_SUMMARY_REQUIRED_CATEGORIES = new Set([
  'Spell/Ability',
  'Rule',
  'Condition',
]);

export function isReferenceSummaryRequired(category: string): boolean {
  return REFERENCE_SUMMARY_REQUIRED_CATEGORIES.has(category);
}

// --- Built-in Templates ---

export const BUILT_IN_CARD_TEMPLATES: CardTemplate[] = [
  {
    id: 'builtin-npc',
    label: 'NPC',
    entity_types: ['character'],
    size_mm: CARD_SIZES.Poker,
    layout: { slots: [{ field: 'name', max_lines: 1, overflow: OVERFLOW_POLICIES.TRUNCATE }, { field: 'description', max_lines: 4, overflow: OVERFLOW_POLICIES.SHRINK }] },
    style: {},
  },
  {
    id: 'builtin-item',
    label: 'Item',
    entity_types: ['item'],
    size_mm: CARD_SIZES.Poker,
    layout: { slots: [{ field: 'name', max_lines: 1, overflow: OVERFLOW_POLICIES.TRUNCATE }, { field: 'description', max_lines: 4, overflow: OVERFLOW_POLICIES.SHRINK }] },
    style: {},
  },
  {
    id: 'builtin-spell',
    label: 'Spell/Ability',
    entity_types: ['ability'],
    size_mm: CARD_SIZES.Poker,
    layout: { slots: [{ field: 'name', max_lines: 1, overflow: OVERFLOW_POLICIES.TRUNCATE }, { field: 'reference_summary', max_lines: 3, overflow: OVERFLOW_POLICIES.SUMMARY_REQUIRED }] },
    style: {},
  },
  {
    id: 'builtin-quest',
    label: 'Quest',
    entity_types: ['quest'],
    size_mm: CARD_SIZES.Tarot,
    layout: { slots: [{ field: 'name', max_lines: 1, overflow: OVERFLOW_POLICIES.TRUNCATE }, { field: 'description', max_lines: 6, overflow: OVERFLOW_POLICIES.SPLIT }] },
    style: {},
  },
  {
    id: 'builtin-clue',
    label: 'Clue',
    entity_types: ['clue'],
    size_mm: CARD_SIZES.Poker,
    layout: { slots: [{ field: 'name', max_lines: 1, overflow: OVERFLOW_POLICIES.TRUNCATE }, { field: 'description', max_lines: 4, overflow: OVERFLOW_POLICIES.SHRINK }] },
    style: {},
  },
  {
    id: 'builtin-faction',
    label: 'Faction',
    entity_types: ['faction'],
    size_mm: CARD_SIZES.Tarot,
    layout: { slots: [{ field: 'name', max_lines: 1, overflow: OVERFLOW_POLICIES.TRUNCATE }, { field: 'description', max_lines: 6, overflow: OVERFLOW_POLICIES.SHRINK }] },
    style: {},
  },
  {
    id: 'builtin-location',
    label: 'Location',
    entity_types: ['location'],
    size_mm: CARD_SIZES.Moderation,
    layout: { slots: [{ field: 'name', max_lines: 1, overflow: OVERFLOW_POLICIES.TRUNCATE }, { field: 'description', max_lines: 8, overflow: OVERFLOW_POLICIES.SPLIT }] },
    style: {},
  },
  {
    id: 'builtin-secret',
    label: 'Secret',
    entity_types: ['secret'],
    size_mm: CARD_SIZES.Poker,
    layout: { slots: [{ field: 'name', max_lines: 1, overflow: OVERFLOW_POLICIES.TRUNCATE }, { field: 'description', max_lines: 4, overflow: OVERFLOW_POLICIES.REFERENCE_ONLY }] },
    style: {},
  },
  {
    id: 'builtin-condition',
    label: 'Condition',
    entity_types: ['condition'],
    size_mm: CARD_SIZES.Poker,
    layout: { slots: [{ field: 'name', max_lines: 1, overflow: OVERFLOW_POLICIES.TRUNCATE }, { field: 'reference_summary', max_lines: 3, overflow: OVERFLOW_POLICIES.SUMMARY_REQUIRED }] },
    style: {},
  },
];

// --- Schema ---

export function applyCardSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS card_templates (
      id           TEXT PRIMARY KEY NOT NULL,
      label        TEXT NOT NULL,
      entity_types TEXT NOT NULL DEFAULT '[]',
      size_mm      TEXT NOT NULL DEFAULT '{}',
      layout       TEXT NOT NULL DEFAULT '{}',
      style        TEXT NOT NULL DEFAULT '{}'
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS card_instances (
      id          TEXT PRIMARY KEY NOT NULL,
      entity_id   TEXT NOT NULL,
      template_id TEXT NOT NULL,
      audience    TEXT NOT NULL DEFAULT 'gm',
      fields      TEXT NOT NULL DEFAULT '{}',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

export function seedBuiltInCardTemplates(db: DatabaseSync): void {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO card_templates (id, label, entity_types, size_mm, layout, style)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const t of BUILT_IN_CARD_TEMPLATES) {
    stmt.run(
      t.id,
      t.label,
      JSON.stringify(t.entity_types),
      JSON.stringify(t.size_mm),
      JSON.stringify(t.layout),
      JSON.stringify(t.style),
    );
  }
}
