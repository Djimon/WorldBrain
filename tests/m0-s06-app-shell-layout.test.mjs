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
