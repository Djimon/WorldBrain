// @vitest-environment node
// Issue #107: MapViewer/GridOverlay/MapEmbedBlock use react-leaflet — architecture decision requires Canvas 2D.

import { describe, expect, it } from 'vitest';

const fs = await import('fs');

function readSrc(path: string) { return fs.readFileSync(path, 'utf8'); }

describe('issue-107 no react-leaflet in map components', () => {
  it('MapViewer.tsx does not import from react-leaflet', () => {
    const src = readSrc('src/ui/MapViewer.tsx');
    expect(src).not.toMatch(/from ['"]react-leaflet['"]/);
  });

  it('GridOverlay.tsx does not import from react-leaflet', () => {
    const src = readSrc('src/ui/GridOverlay.tsx');
    expect(src).not.toMatch(/from ['"]react-leaflet['"]/);
  });

  it('MapEmbedBlock.tsx does not import from react-leaflet', () => {
    const src = readSrc('src/blocks/MapEmbedBlock.tsx');
    expect(src).not.toMatch(/from ['"]react-leaflet['"]/);
  });

  it('MapViewer.tsx does not import from leaflet directly', () => {
    const src = readSrc('src/ui/MapViewer.tsx');
    expect(src).not.toMatch(/from ['"]leaflet['"]/);
  });

  it('MapViewer.tsx uses a Canvas element or MapCanvas component', () => {
    const src = readSrc('src/ui/MapViewer.tsx');
    expect(src).toMatch(/<canvas|MapCanvas|<Canvas/);
  });

  it('GridOverlay.tsx uses canvas draw calls or CSS positioning, not Leaflet SVGOverlay', () => {
    const src = readSrc('src/ui/GridOverlay.tsx');
    expect(src).not.toMatch(/SVGOverlay|useMap\(\)|getBounds\(\)/);
    expect(src).toMatch(/canvas|ctx\.|getContext|position.*absolute|drawLine|fillRect/i);
  });

  it('package.json does not list react-leaflet as a dependency', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(allDeps).not.toHaveProperty('react-leaflet');
  });
});
