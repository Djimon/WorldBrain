// M16-S00b (#326): standalone entry for the OPEN renderer bench. Throwaway
// PoC, own html/window — not wired through the app (like the #320 spike).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GraphBench } from './GraphBench';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <GraphBench />
  </StrictMode>,
);
