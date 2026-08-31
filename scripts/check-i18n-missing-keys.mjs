// #399: static guard — every t('key', …) used in the code must resolve to a real
// locale key, else the component silently renders its inline default (usually
// German) and never switches language. Complements the en<->de parity test.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const LOCALES = 'src/locales/de';
const NAMESPACES = ['common', 'nav', 'entity', 'map', 'session', 'multiplayer'];

function flatten(obj, prefix = '') {
  const out = new Set();
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) for (const kk of flatten(v, key)) out.add(kk);
    else out.add(key);
  }
  return out;
}

const keysByNs = {};
for (const ns of NAMESPACES) keysByNs[ns] = flatten(JSON.parse(readFileSync(`${LOCALES}/${ns}.json`, 'utf8')));

function walk(dir) {
  const res = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!p.includes('locales')) res.push(...walk(p)); }
    else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) res.push(p);
  }
  return res;
}

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
    if (key.endsWith('.') || key.includes('${')) continue; // dynamic key fragment
    if (!NAMESPACES.includes(ns)) continue;
    if (!keysByNs[ns] || !keysByNs[ns].has(key)) missing.push(`${f.replace(/\\/g, '/')}  ::  ${ns}:${key}`);
  }
}
const uniq = [...new Set(missing)].sort();
console.log(uniq.join('\n'));
console.log(`\nTOTAL missing keys used in code: ${uniq.length}`);
