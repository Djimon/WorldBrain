// @ts-check
// Gate 1 (DEV-UI-GUIDE enforcement): colours must come from tokens, not raw
// literals. Scans all CSS except the token/theme source-of-truth files and
// fails on raw hex / rgb() / hsl() colour values.
//
// Comments are stripped first, so issue references like `/* #300 follow-up */`
// are NOT mistaken for 3-digit hex colours.
//
// A baseline (scripts/.hardcoded-color-baseline.json) grandfathers the colours
// that already existed when the gate was introduced: existing ones are tolerated,
// but any NEW raw colour (or more occurrences of an existing one) fails the gate.
// Regenerate the baseline intentionally with:  node scripts/check-hardcoded-colors.mjs --update-baseline

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const BASELINE = join(ROOT, 'scripts', '.hardcoded-color-baseline.json');
const CSS_ROOT = join(ROOT, 'src');

// Source-of-truth files where raw colours are allowed (that's their job).
const ALLOWED = [join('src', 'styles', 'tokens.css'), join('src', 'styles', 'themes') + sep];

// hex (#rgb, #rgba, #rrggbb, #rrggbbaa) OR rgb()/rgba()/hsl()/hsla()
const COLOR_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|(?:rgba?|hsla?)\([^)]*\)/g;

/** @param {string} css */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

/** @param {string} dir @param {string[]} out */
function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.css')) out.push(p);
  }
  return out;
}

/** @param {string} rel */
const isAllowed = (rel) => ALLOWED.some((a) => rel === a || rel.startsWith(a));

/** @returns {Record<string, Record<string, number>>} file -> {normalizedColor: count} */
function collect() {
  /** @type {Record<string, Record<string, number>>} */
  const found = {};
  for (const file of walk(CSS_ROOT, [])) {
    const rel = relative(ROOT, file);
    if (isAllowed(rel)) continue;
    const code = stripComments(readFileSync(file, 'utf8'));
    const matches = code.match(COLOR_RE);
    if (!matches) continue;
    const relKey = rel.split(sep).join('/');
    found[relKey] ??= {};
    for (const raw of matches) {
      const norm = raw.toLowerCase().replace(/\s+/g, '');
      found[relKey][norm] = (found[relKey][norm] ?? 0) + 1;
    }
  }
  return found;
}

const current = collect();

if (process.argv.includes('--update-baseline')) {
  writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n');
  console.log(`✓ colour baseline updated (${Object.keys(current).length} files).`);
  process.exit(0);
}

/** @type {Record<string, Record<string, number>>} */
const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};

/** @type {string[]} */
const violations = [];
for (const [file, colors] of Object.entries(current)) {
  for (const [color, count] of Object.entries(colors)) {
    const allowed = baseline[file]?.[color] ?? 0;
    if (count > allowed) {
      violations.push(`  ${file}: ${color}${allowed ? ` (${count - allowed} new beyond ${allowed} grandfathered)` : ' (new)'}`);
    }
  }
}

if (violations.length) {
  console.error('BLOCKED: hardcoded colours (Gate 1, DEV-UI-GUIDE). Use var(--color-*) tokens instead.');
  console.error('If a token is genuinely missing, add it to src/styles/tokens.css and reference it.\n');
  console.error(violations.join('\n'));
  console.error('\n(Legit? Only then: node scripts/check-hardcoded-colors.mjs --update-baseline)');
  process.exit(1);
}

console.log('✓ no new hardcoded colours.');
