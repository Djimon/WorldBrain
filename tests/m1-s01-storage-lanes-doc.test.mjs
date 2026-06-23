import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const storageDecisionDocPath = join(repoRoot, 'planning', 'epics', 'EPIC-002-json-ground-truth-runtime-database.md');

function readStorageDecisionDoc() {
  assert.ok(existsSync(storageDecisionDocPath), 'Expected M1 storage decision documentation to exist');

  return readFileSync(storageDecisionDocPath, 'utf8');
}

function assertStorageDecision(pattern, message) {
  assert.match(readStorageDecisionDoc(), pattern, message);
}

test('M1-S01 documents base JSON as authoritative predefined content imported into SQLite', () => {
  assertStorageDecision(
    /base\s+JSON.{0,120}(?:authoritative|source of truth).{0,120}(?:predefined|configured|base).{0,80}content/isu,
    'Expected documentation to state that base JSON is authoritative for predefined/configured content',
  );
  assertStorageDecision(
    /base\s+JSON.{0,120}imported.{0,80}SQLite.{0,120}(?:fast UI reads|queries|read|query)/isu,
    'Expected documentation to state that base JSON is imported into SQLite for fast UI reads and queries',
  );
});

test('M1-S01 documents campaign progression as durable SQLite state that does not mutate base JSON', () => {
  assertStorageDecision(
    /campaign.{0,80}(?:session|progression).{0,120}(?:SQLite|database).{0,120}(?:not|never|must not).{0,80}(?:write|written|mutate).{0,80}base\s+JSON/isu,
    'Expected documentation to state that campaign/session progression is stored in SQLite and not written to base JSON',
  );
});

test('M1-S01 documents the M1 single-database prefix boundary for base and campaign tables', () => {
  assertStorageDecision(
    /one\s+SQLite\s+database.{0,120}`?base_`?.{0,80}`?campaign_`?/isu,
    'Expected documentation to state that M1 uses one SQLite database with base_ and campaign_ table prefixes',
  );
});

test('M1-S01 documents rebuildable base tables and durable campaign tables across re-imports', () => {
  assertStorageDecision(
    /`?base_\*`?\s+tables.{0,120}rebuildable.{0,80}(?:from|by)\s+JSON/isu,
    'Expected documentation to state that base_* tables are rebuildable from JSON',
  );
  assertStorageDecision(
    /`?campaign_\*`?\s+tables.{0,120}durable.{0,120}(?:survive|preserve|remain).{0,80}(?:base\s+)?re-imports?/isu,
    'Expected documentation to state that campaign_* tables survive base re-imports',
  );
});

test('M1-S01 documents campaign overlay export as a later boundary outside M1 unless explicit', () => {
  assertStorageDecision(
    /campaign\s+overlay\/export.{0,120}(?:later boundary|out of scope|future).{0,120}(?:unless explicitly implemented|unless explicit|not implemented in M1)/isu,
    'Expected documentation to identify campaign overlay/export as a later boundary unless explicitly implemented in M1',
  );
});
