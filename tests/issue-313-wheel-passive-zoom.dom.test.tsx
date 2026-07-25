// bug(p2 maps): Zoom wirft "preventDefault inside passive event listener" (#313)
// See: https://github.com/Djimon/WorldBrain/issues/313
//
// Root cause: handleWheel is wired via the React synthetic `onWheel` prop
// (MapViewer.tsx ~366) and calls e.preventDefault(). React registers its
// delegated `wheel` listener as passive by default (React 19); preventDefault
// inside a passive listener is a no-op and logs this warning.
//
// Fix direction (per issue): register `wheel` as a NATIVE listener with
// `{ passive: false }` on containerRef via addEventListener/removeEventListener
// in a useEffect, instead of the synthetic onWheel prop — preventDefault then
// works again. Zoom behavior (clamp 0.1-10, focus on cursor) stays unchanged.
//
// Note: jsdom's synthetic event system does not reproduce the real browser's
// passive-listener enforcement (verified: firing a wheel event and spying on
// console.error shows no warning either way, regardless of whether the
// handler is native or synthetic). A behavioral "dispatch a native wheel
// event and check zoom changed" test was tried and discarded: React installs
// its own native root-level listener for delegation, so a plain
// `dispatchEvent(new WheelEvent(...))` reaches the synthetic onWheel handler
// just as well as a real native listener would — the test passed identically
// whether the fix was applied or not, proving nothing (same false-positive
// shape as the #308/#300 lessons). The regression is therefore pinned purely
// structurally: no more synthetic onWheel, a genuine native
// addEventListener with passive:false.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('#313 (structural): wheel handler is a native listener, not the synthetic onWheel prop', () => {
  it('MapViewer.tsx no longer wires handleWheel via the synthetic onWheel prop', () => {
    const src = readFileSync('src/ui/MapViewer.tsx', 'utf-8');
    expect(src).not.toMatch(/onWheel=\{handleWheel\}/);
  });

  it('MapViewer.tsx registers a native wheel listener with { passive: false }', () => {
    const src = readFileSync('src/ui/MapViewer.tsx', 'utf-8');
    expect(src).toMatch(/addEventListener\(\s*['"]wheel['"][\s\S]{0,200}passive:\s*false/);
  });

  it('the outdated "onWheel as React synthetic handler works in Tauri" comment is gone', () => {
    const src = readFileSync('src/ui/MapViewer.tsx', 'utf-8');
    expect(src).not.toMatch(/onWheel as React synthetic handler works in Tauri/);
  });
});
