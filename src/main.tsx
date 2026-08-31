import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import { App } from './App';
import { AudioSoundboardWindow } from './ui/AudioSoundboardWindow';
import { initTheme, bootstrapUserThemes, getStoredThemeId } from './theme';
import { isBuiltinThemeId } from './styles/theme-registry';

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
const soundboardParams = new URLSearchParams(window.location.search);
const soundboardDbPath = soundboardParams.get('db');
const soundboardProjectDir = soundboardParams.get('projectDir');

function mountApp(): void {
  createRoot(rootElement as HTMLElement).render(
    <StrictMode>
      {isSoundboardWindow
        ? <AudioSoundboardWindow dbPath={soundboardDbPath} projectDir={soundboardProjectDir} />
        : <App />}
    </StrictMode>,
  );
}

// #393: importierbare User-Themes für JEDES Fenster registrieren (auch die
// abgedockten Soundboard-/Player-Fenster mit eigenem JS-Kontext), sonst degradiert
// ein aktives User-Theme dort still auf die Default-Palette.
// #396: ist das GESPEICHERTE Theme ein Built-in, sofort painten und parallel scannen
// (kein Flash möglich). Ist es ein NICHT-Built-in (User-Theme, zu diesem Zeitpunkt
// noch nicht registriert), erst scannen+anwenden, DANN painten — vermeidet den
// kurzen Default-Paletten-Flash.
if (isBuiltinThemeId(getStoredThemeId())) {
  void bootstrapUserThemes();
  mountApp();
} else {
  void bootstrapUserThemes().finally(mountApp);
}
