import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import { App } from './App';
import { AudioSoundboardWindow } from './ui/AudioSoundboardWindow';
import { PlayerClientApp } from './ui/PlayerClientApp';
import { initTheme } from './theme';

// Apply the persisted theme before first render (no flash) and keep this window
// in sync with theme changes from other windows. Runs for EVERY window — the
// detached soundboard/player windows have no ThemeToggle, so this is the only
// thing that themes them (previously only 'dark' was handled, so a 'toxic'
// preference stripped data-theme and left detached windows on light).
initTheme();

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
const isPlayerWindow = window.location.hash === '#/player';
const soundboardParams = new URLSearchParams(window.location.search);
const soundboardDbPath = soundboardParams.get('db');
const soundboardProjectDir = soundboardParams.get('projectDir');

createRoot(rootElement).render(
  <StrictMode>
    {isPlayerWindow
      ? <PlayerClientApp />
      : isSoundboardWindow
        ? <AudioSoundboardWindow dbPath={soundboardDbPath} projectDir={soundboardProjectDir} />
        : <App />}
  </StrictMode>,
);
