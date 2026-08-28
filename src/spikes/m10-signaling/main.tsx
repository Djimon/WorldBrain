// M10-D28 (#380) Spike-Entry — throwaway.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SignalingSpike } from './SignalingSpike';

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('Root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <SignalingSpike />
  </StrictMode>,
);
