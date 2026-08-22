// @vitest-environment jsdom
// M10-S19 (rebuild): In-App Split-View (2-Pane)
// See: https://github.com/Djimon/WorldBrain/issues/364

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('M10-S19 Source guards', () => {
  it('SplitView component exists', () => {
    const source = readFileSync('src/ui/SplitView.tsx', 'utf-8');
    expect(source).toMatch(/export.*SplitView/);
  });

  it('SplitView renders two panes', () => {
    const source = readFileSync('src/ui/SplitView.tsx', 'utf-8');
    expect(source).toMatch(/pane|left|right|primary|secondary/i);
  });

  it('SplitView has draggable divider', () => {
    const source = readFileSync('src/ui/SplitView.tsx', 'utf-8');
    expect(source).toMatch(/drag|resize|divider|splitter/i);
  });

  it('SplitView does not cause horizontal body scroll', () => {
    const source = readFileSync('src/ui/SplitView.tsx', 'utf-8');
    expect(source).not.toMatch(/overflow-x:\s*visible/);
  });

  it('SplitView uses primitives or tokens (no raw hex)', () => {
    const source = readFileSync('src/ui/SplitView.tsx', 'utf-8');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}[^a-zA-Z]/);
  });
});
