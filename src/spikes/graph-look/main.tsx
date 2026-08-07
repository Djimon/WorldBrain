// M16-S03 look-tuner entry (throwaway PoC, own html/window).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GraphLookTuner } from './GraphLookTuner';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <GraphLookTuner />
  </StrictMode>,
);
