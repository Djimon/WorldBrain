// M16-S00 (#320): standalone entry for the react-force-graph-3d spike.
// Deliberately NOT wired through main.tsx/App — this is throwaway PoC code
// per the issue ("spike code is throwaway, do not ship it in production
// paths"), so it gets its own html/entry/window instead of a route.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GraphWebglSpike } from './GraphWebglSpike';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <GraphWebglSpike />
  </StrictMode>,
);
