// Pre-commit Build-Zähler + Cargo-Versions-Sync.
// Regel 1 (build): bei jedem Commit `build` um 1 erhöhen — AUSSER die `version`
//   hat sich gegenüber dem letzten Commit geändert, dann `build` auf 0 zurück.
//   Basis der Erhöhung ist die zuletzt COMMITTETE build-Zahl (HEAD), damit
//   Working-Tree-Änderungen nichts aufsummieren (idempotent pro Commit).
// Regel 2 (cargo): src-tauri/Cargo.toml `[package].version` immer auf
//   package.json `version` ziehen (nur diese eine Zeile, keine Dependencies).
// Schreibt + staged die betroffenen Dateien. Blockiert einen Commit NIE.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const PKG = 'package.json';
const CARGO = 'src-tauri/Cargo.toml';

function prevPackage() {
  try {
    const raw = execSync('git show HEAD:package.json', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(raw);
  } catch {
    return null; // kein HEAD (erster Commit) oder package.json nicht getrackt
  }
}

const inCommit = process.env.GIT_INDEX_FILE !== undefined;
function stage(file) {
  if (!inCommit) return; // manueller Aufruf: nur schreiben, nicht stagen
  try { execSync(`git add ${file}`, { stdio: 'ignore' }); } catch { /* egal */ }
}

// Ersetzt NUR die version-Zeile im [package]-Block (stoppt vor der nächsten
// Tabelle `[`), damit Dependency-Versionen unangetastet bleiben.
function syncCargoVersion(version) {
  if (!existsSync(CARGO)) return;
  const text = readFileSync(CARGO, 'utf8');
  const re = /(\[package\][^[]*?\nversion\s*=\s*")([^"]*)(")/;
  const m = re.exec(text);
  if (m === null) {
    console.error(`cargo-sync übersprungen: [package].version in ${CARGO} nicht gefunden`);
    return;
  }
  if (m[2] === version) return; // schon gleichgezogen
  const next = text.replace(re, `$1${version}$3`);
  writeFileSync(CARGO, next);
  stage(CARGO);
  console.log(`→ Cargo.toml version → ${version} (war ${m[2]})`);
}

try {
  const pkg = JSON.parse(readFileSync(PKG, 'utf8'));
  const prev = prevPackage();

  const versionChanged = prev !== null && prev.version !== pkg.version;
  const base = prev !== null && Number.isInteger(prev.build)
    ? prev.build
    : (Number.isInteger(pkg.build) ? pkg.build : 0);
  const newBuild = versionChanged ? 0 : base + 1;

  pkg.build = newBuild;
  writeFileSync(PKG, `${JSON.stringify(pkg, null, 2)}\n`);
  stage(PKG);

  console.log(
    versionChanged
      ? `→ build reset auf 0 (version ${pkg.version})`
      : `→ build ${newBuild} (v${pkg.version})`,
  );

  // Cargo immer auf die package.json-Version ziehen (auch wenn nur build stieg).
  syncCargoVersion(pkg.version);
} catch (err) {
  console.error(`build-bump übersprungen: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(0); // niemals den Commit blockieren
}
