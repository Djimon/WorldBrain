import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import { App } from './App';
import { AudioSoundboardWindow } from './ui/AudioSoundboardWindow';

// Apply persisted theme before first render to avoid flash. Symmetric add/
// remove (not just add) — index.html hardcodes data-theme="dark", and only
// the main window's ThemeToggle (mount-time effect) ever removed it for
// light mode; the soundboard window has no ThemeToggle, so it was always
// stuck on the hardcoded dark default regardless of the stored preference.
const storedTheme = localStorage.getItem('theme') ?? 'dark';
if (storedTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
else document.documentElement.removeAttribute('data-theme');

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
const soundboardParams = new URLSearchParams(window.location.search);
const soundboardDbPath = soundboardParams.get('db');
const soundboardProjectDir = soundboardParams.get('projectDir');

createRoot(rootElement).render(
  <StrictMode>
    {isSoundboardWindow
      ? <AudioSoundboardWindow dbPath={soundboardDbPath} projectDir={soundboardProjectDir} />
      : <App />}
  </StrictMode>,
);
