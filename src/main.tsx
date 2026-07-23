import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import { App } from './App';
import { AudioSoundboardWindow } from './ui/AudioSoundboardWindow';

// Apply persisted theme before first render to avoid flash
const storedTheme = localStorage.getItem('theme') ?? 'dark';
if (storedTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Root element not found');
}

// The detached audio-soundboard WebviewWindow (EPIC-024/D1) loads this same
// index.html with a distinguishing hash — route it to its own root here
// rather than through App's project-bootstrap flow.
const isSoundboardWindow = window.location.hash === '#/audio-soundboard';

createRoot(rootElement).render(
  <StrictMode>
    {isSoundboardWindow ? <AudioSoundboardWindow /> : <App />}
  </StrictMode>,
);
