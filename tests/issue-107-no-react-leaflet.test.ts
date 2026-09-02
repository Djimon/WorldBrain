// @vitest-environment node
// Issue #107: MapViewer/GridOverlay/MapEmbedBlock use react-leaflet — architecture decision requires Canvas 2D.
//
// #291/#400: GridOverlay.tsx was dead code (superseded by MapGrid.tsx/GridLayer)
// and has since been DELETED in the repo cleanup (commit d8e3030). Its two
// .deprecated-path assertions are removed here.
// #412/#431: MapEmbedBlock.tsx was dead code (no map-in-entity-text embed) and was
// DELETED when maps became a gated feature — its react-leaflet assertion is removed.
// The react-leaflet guard on the live map components (MapViewer/GridLayer/package.json) stays.

import { describe, expect, it } from 'vitest';

const fs = await import('fs');

function readSrc(path: string) { return fs.readFileSync(path, 'utf8'); }

describe('issue-107 no react-leaflet in map components', () => {
  it('MapViewer.tsx does not import from react-leaflet', () => {
    const src = readSrc('src/ui/MapViewer.tsx');
    expect(src).not.toMatch(/from ['"]react-leaflet['"]/);
  });

  it('MapViewer.tsx does not import from leaflet directly', () => {
    const src = readSrc('src/ui/MapViewer.tsx');
    expect(src).not.toMatch(/from ['"]leaflet['"]/);
  });

  // #291: the actual Canvas-2D grid rendering lives in GridLayer (./MapGrid),
  // not a literal <canvas>/MapCanvas in MapViewer.tsx's own source — the
  // original assertion assumed a component name that was never built this
  // way. GridLayer is real, wired, and tested (verified in code, not stale).
  it('MapViewer.tsx uses a Canvas element, MapCanvas, or GridLayer component', () => {
    const src = readSrc('src/ui/MapViewer.tsx');
    expect(src).toMatch(/<canvas|MapCanvas|<Canvas|GridLayer/);
  });

  it('package.json does not list react-leaflet as a dependency', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(allDeps).not.toHaveProperty('react-leaflet');
  });
});
