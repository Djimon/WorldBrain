import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const appPath = join(repoRoot, 'src', 'App.tsx');
const stylePath = join(repoRoot, 'src', 'style.css');

const appSource = readFileSync(appPath, 'utf8');
const styleSource = readFileSync(stylePath, 'utf8');
const combinedSource = `${appSource}\n${styleSource}`;

function assertPattern(input, pattern, message) {
  assert.ok(pattern.test(input), message);
}

function assertNoPattern(input, pattern, message) {
  assert.ok(!pattern.test(input), message);
}

test('M0-S06 renders a stable shell header with project identity and global controls', () => {
  assertPattern(appSource, /<header\b[^>]*className=["'][^"']*app-shell__header/u, 'Expected app shell header region');
  assertPattern(appSource, /WorldBuilderX/u, 'Expected project identity text in app shell');
  assertPattern(appSource, /global\s+controls|aria-label=["'][^"']*global/i, 'Expected labelled global controls area');
  assertPattern(appSource, /<Button\b/u, 'Expected global controls to use local Button primitive');
  assertPattern(appSource, /<StatusChip\b/u, 'Expected header status to use local StatusChip primitive');
});

test('M0-S06 renders primary navigation wired to placeholder view selection', () => {
  assertPattern(appSource, /useState\s*</u, 'Expected shell view selection state');
  assertPattern(appSource, /active(?:View|Id)|selected(?:View|Id)/u, 'Expected explicit active view state naming');
  assertPattern(appSource, /<Tabs\b/u, 'Expected primary navigation to use local Tabs primitive');
  assertPattern(appSource, /aria-label=["'][^"']*(?:primary|navigation|workspace)/iu, 'Expected labelled primary navigation');
  assertPattern(appSource, /onSelect=\{[^}]*set/u, 'Expected tab selection to update active shell view state');
});

test('M0-S06 renders a main workspace with shell-level placeholder views', () => {
  assertPattern(appSource, /<main\b[^>]*className=["'][^"']*app-shell__workspace/u, 'Expected main workspace region');
  assertPattern(appSource, /placeholder/iu, 'Expected placeholder view language in shell implementation');
  assertPattern(appSource, /shellViews|placeholderViews|workspaceViews/u, 'Expected explicit shell placeholder view definitions');
  assertPattern(appSource, /\.find\(|\.map\(/u, 'Expected view definitions to drive workspace rendering');
  assertPattern(appSource, /<Panel\b/u, 'Expected workspace surfaces to use local Panel primitive');
});

test('M0-S06 includes a status or development surface for runtime state', () => {
  assertPattern(appSource, /<footer\b|role=["']status["']|app-shell__status/u, 'Expected footer/status/dev surface region');
  assertPattern(appSource, /(?:build|runtime|renderer|tauri|m0)/iu, 'Expected shell status surface to expose build/runtime state text');
  assertPattern(appSource, /<StatusChip\b/u, 'Expected status surface to use local StatusChip primitive');
});

test('M0-S06 layout uses internal scroll containers instead of page-level growth', () => {
  assertPattern(styleSource, /body\s*\{[^}]*overflow\s*:\s*hidden/isu, 'Expected page overflow hidden for desktop shell');
  assertPattern(styleSource, /\.app-shell\s*\{[^}]*(?:height|min-height)\s*:\s*100vh/isu, 'Expected app shell to fill the viewport');
  assertPattern(styleSource, /\.app-shell\s*\{[^}]*display\s*:\s*grid/isu, 'Expected app shell to use stable grid layout');
  assertPattern(styleSource, /\.app-shell__workspace\s*\{[^}]*min-height\s*:\s*0/isu, 'Expected workspace min-height: 0 for nested scrolling');
  assertPattern(styleSource, /\.app-shell__workspace\s*\{[^}]*overflow\s*:\s*hidden/isu, 'Expected workspace overflow containment');
  assertPattern(styleSource, /(?:__content|__view|__panel-body)\s*\{[^}]*overflow\s*:\s*auto/isu, 'Expected inner shell area to scroll internally');
});

test('M0-S06 placeholder views avoid implementing out-of-scope domain behavior', () => {
  assertNoPattern(appSource, /\b(?:fetch|localStorage|indexedDB|WebSocket|new\s+Worker)\b/u, 'Expected no persistence/network/runtime feature behavior');
  assertNoPattern(appSource, /\b(?:EntitySchema|MapMarker|SessionState|RuleEngine|SearchIndex)\b/u, 'Expected no domain model implementation in shell placeholder');
  assertNoPattern(appSource, /\buseEffect\s*\(/u, 'Expected placeholder shell not to run side-effect workflows');
});

test('M0-S06 remains desktop-first while readable at narrower widths', () => {
  assertPattern(styleSource, /grid-template-(?:columns|areas)/u, 'Expected desktop-first grid layout definition');
  assertPattern(styleSource, /@media\s*\(\s*max-width\s*:\s*(?:900|820|768|720|640)px\s*\)/u, 'Expected narrow-width responsive shell rule');
  assertPattern(styleSource, /app-shell__nav/iu, 'Expected navigation-specific responsive styling');
  assertNoPattern(combinedSource, /font-size\s*:\s*clamp\(/u, 'Expected compact shell text sizing instead of viewport-scaled hero type');
});
