// #399: static i18n guards.
//  (A) MISSING KEYS — every t('key', …) used in code must resolve to a real
//      locale key, else the component silently renders its inline default
//      (usually German) and never switches language.
//  (B) GENERIC DUPLICATES — a non-common namespace must not redefine a value
//      that already exists as a generic word in `common` (save/cancel/delete/…).
//      Those belong in `common` and must be referenced via { ns: 'common' } —
//      otherwise the same word gets translated N times (DRY violation).
// Complements the en<->de parity test.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const NAMESPACES = ['common', 'nav', 'entity', 'map', 'session', 'multiplayer'];

function flatten(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out.set(key, v);
  }
  return out;
}

const enByNs = {}, deByNs = {};
for (const ns of NAMESPACES) {
  enByNs[ns] = flatten(JSON.parse(readFileSync(`src/locales/en/${ns}.json`, 'utf8')));
  deByNs[ns] = flatten(JSON.parse(readFileSync(`src/locales/de/${ns}.json`, 'utf8')));
}

function walk(dir, res = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!p.includes('locales')) walk(p, res); }
    else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) res.push(p);
  }
  return res;
}

// ── (A) missing keys ────────────────────────────────────────────────────────
const missing = [];
for (const f of walk('src')) {
  const src = readFileSync(f, 'utf8');
  const nsMatch = src.match(/useTranslation\(\s*['"]([^'"]+)['"]/);
  const fileNs = nsMatch ? nsMatch[1] : 'common';
  const re = /\bt\(\s*['"]([a-zA-Z0-9_.:-]+)['"]([^)]*)/g;
  let m;
  while ((m = re.exec(src))) {
    let key = m[1];
    const rest = m[2] || '';
    let ns = fileNs;
    if (key.includes(':')) { const parts = key.split(':'); ns = parts[0]; key = parts[1]; }
    const nsm = rest.match(/ns:\s*['"]([^'"]+)['"]/);
    if (nsm) ns = nsm[1];
    if (key.endsWith('.') || key.includes('${')) continue;
    if (!NAMESPACES.includes(ns)) continue;
    // plural-aware: `key` counts as present if a plural variant exists
    const has = (map) => map.has(key) || ['_one', '_other', '_zero', '_two', '_few', '_many'].some((s) => map.has(key + s));
    if (!has(deByNs[ns] || new Map())) missing.push(`${f.replace(/\\/g, '/')}  ::  ${ns}:${key}`);
  }
}
const uMissing = [...new Set(missing)].sort();

// ── (B) generic duplicates ──────────────────────────────────────────────────
// Reference set = the CANONICAL generic words in common (a fixed whitelist, so
// component keys someone dumped into common don't get treated as generics).
const CANONICAL = ['save', 'cancel', 'edit', 'delete', 'close', 'loading', 'error',
  'add', 'remove', 'search', 'filter', 'back', 'create', 'confirm', 'yes', 'no', 'all'];
// Allowlist: same string, deliberately different meaning (not a duplicate).
// Keep this TIGHT — only genuine semantic collisions (a mode/option NAME that
// happens to match a generic action word), never plain laziness.
const ALLOW = new Set([
  'nav:modeEdit',      // app-mode name "Bearbeiten" (edit mode), not the edit action
  'nav:modePlay',      // app-mode name "Spielen"
  'nav:audioModeAdd',  // audio mix mode "Add" (vs "Replace"), not the add action
]);
const canonDe = new Map(), canonEn = new Map();
for (const k of CANONICAL) {
  if (deByNs.common.has(k)) canonDe.set(String(deByNs.common.get(k)), k);
  if (enByNs.common.has(k)) canonEn.set(String(enByNs.common.get(k)), k);
}
// Also flag component keys polluting `common` itself (e.g. nestedTree.cancel="Abbrechen").
const dupes = [];
for (const ns of NAMESPACES) {
  for (const [key, deVal] of deByNs[ns]) {
    if (ns === 'common' && CANONICAL.includes(key)) continue; // the canonical entries themselves
    if (ALLOW.has(`${ns}:${key}`)) continue;
    const cDe = canonDe.get(String(deVal));
    const cEn = canonEn.get(String(enByNs[ns].get(key)));
    if (cDe && cEn && cDe === cEn) dupes.push(`${ns}:${key} = "${deVal}" -> use common:${cDe}`);
  }
}
const uDupes = [...new Set(dupes)].sort();

console.log('── (A) missing keys used in code ──');
console.log(uMissing.join('\n'));
console.log(`\nTOTAL missing keys used in code: ${uMissing.length}`);
console.log('\n── (B) generic duplicates (should reference common) ──');
console.log(uDupes.join('\n'));
console.log(`\nTOTAL generic duplicates: ${uDupes.length}`);

process.exitCode = (uMissing.length + uDupes.length) > 0 ? 1 : 0;
