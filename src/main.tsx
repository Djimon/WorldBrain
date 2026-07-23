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
// rather than through App's project-bootstrap flow. The db path travels as a
// query param since this is a separate window/JS context with no state
// shared with the main window's React tree.
const isSoundboardWindow = window.location.hash === '#/audio-soundboard';
const soundboardDbPath = new URLSearchParams(window.location.search).get('db');

createRoot(rootElement).render(
  <StrictMode>
    {isSoundboardWindow ? <AudioSoundboardWindow dbPath={soundboardDbPath} /> : <App />}
  </StrictMode>,
);
