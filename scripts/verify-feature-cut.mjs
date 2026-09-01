// pre-release S2 (#404) — AC5 bundle proof.
// Verifies that features switched OFF in features.json are really tree-shaken out of
// the release bundle: their lazy-import chunks must NOT exist in dist/, and features
// switched ON must have their chunk present. Run AFTER a release build:
//
//   npm run build        # tsc --noEmit && vite build → dist/
//   node scripts/verify-feature-cut.mjs
//
// Exit 0 = every off-feature is gone and every on-feature is present. Exit 1 = leak.
// S3 reuses this per cut feature. See src/config/features.ts + src/ui/WorkspaceShell.tsx.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);
const distAssets = fileURLToPath(new URL('./dist/assets', root));
const features = JSON.parse(readFileSync(fileURLToPath(new URL('./features.json', root)), 'utf8'));

// Each gate-able feature → the Vite lazy-chunk basenames it produces (dynamic import()
// chunks are named after the imported module). Keep in sync with the lazy mounts in
// src/ui/WorkspaceShell.tsx.
const FEATURE_CHUNKS = {
  chronicle: ['ChronicleView'],
  cards: ['CardList', 'CardCreationFlow', 'PrintSheetComposer'],
  plugins: ['PluginManager'],
  rules: ['RulesArea'],
};

if (!existsSync(distAssets)) {
  console.error(`✗ dist/assets not found — run \`npm run build\` first (${distAssets}).`);
  process.exit(1);
}

const files = readdirSync(distAssets);
const chunkPresent = (base) => files.some((f) => new RegExp(`^${base}-[^/]*\\.js$`).test(f));

let leaked = false;
let missing = false;

for (const [id, chunks] of Object.entries(FEATURE_CHUNKS)) {
  const released = features[id] === true;
  for (const base of chunks) {
    const present = chunkPresent(base);
    if (!released && present) {
      console.error(`✗ LEAK: feature "${id}" is OFF but chunk ${base}-*.js is in dist/`);
      leaked = true;
    } else if (released && !present) {
      console.error(`✗ MISSING: feature "${id}" is ON but chunk ${base}-*.js is not in dist/`);
      missing = true;
    } else {
      console.log(`✓ ${id} (${base}): ${released ? 'present (on)' : 'tree-shaken (off)'}`);
    }
  }
}

if (leaked || missing) {
  process.exit(1);
}
console.log('\nAll features match features.json — no unreleased code in dist/.');
