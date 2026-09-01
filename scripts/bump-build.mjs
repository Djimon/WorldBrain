// Pre-commit build counter + Cargo version sync.
// Rule 1 (build): on every commit increment `build` by 1 — UNLESS the `version`
//   has changed relative to the last commit, then reset `build` to 0.
//   The increment base is the last COMMITTED build number (HEAD), so that
//   working-tree changes do not accumulate (idempotent per commit).
// Rule 2 (cargo): always pull src-tauri/Cargo.toml `[package].version` to
//   package.json `version` (only this one line, no dependencies).
// Writes + stages the affected files. NEVER blocks a commit.
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
    return null; // no HEAD (first commit) or package.json not tracked
  }
}

const inCommit = process.env.GIT_INDEX_FILE !== undefined;
function stage(file) {
  if (!inCommit) return; // manual invocation: only write, do not stage
  try { execSync(`git add ${file}`, { stdio: 'ignore' }); } catch { /* ignore */ }
}

// Replaces ONLY the version line in the [package] block (stops before the next
// table `[`), so that dependency versions stay untouched.
function syncCargoVersion(version) {
  if (!existsSync(CARGO)) return;
  const text = readFileSync(CARGO, 'utf8');
  const re = /(\[package\][^[]*?\nversion\s*=\s*")([^"]*)(")/;
  const m = re.exec(text);
  if (m === null) {
    console.error(`cargo-sync übersprungen: [package].version in ${CARGO} nicht gefunden`);
    return;
  }
  if (m[2] === version) return; // already in sync
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

  // Always pull Cargo to the package.json version (even if only build increased).
  syncCargoVersion(pkg.version);
} catch (err) {
  console.error(`build-bump übersprungen: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(0); // never block the commit
}
