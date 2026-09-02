import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import { App } from './App';
import { initTheme, bootstrapUserThemes, getStoredThemeId } from './theme';
import { isBuiltinThemeId } from './styles/theme-registry';
import { ensureUserDataDirs } from './services/user-data-dir';

// pre-release S2 (#404): the audio feature (soundboard window + its services) is
// reached only via this dynamic import, gated by the __FEATURE_AUDIO__ compile
// constant, so a release build with "audio": false tree-shakes it out of dist/.
// import.meta.env.DEV keeps it in the dev run. See src/config/features.ts.
const AudioSoundboardWindow = import.meta.env.DEV || __FEATURE_AUDIO__
  ? lazy(() => import('./ui/AudioSoundboardWindow').then((m) => ({ default: m.AudioSoundboardWindow })))
  : null;

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

// pre-release S4 (#406): first-run bootstrap of the user-visible data dirs
// (Documents\WorldsAndBeyond\{projects,plugins,themes} + theme-tester seed). Main
// window only — the detached soundboard window shares the same index.html. Idempotent
// and non-Tauri-safe; fire-and-forget — not sequenced with the theme scan below (no
// ordering guarantee, and none needed: on a real first run there are no user themes to
// scan yet, and the seeding is idempotent, so a race is benign).
if (!isSoundboardWindow) {
  void ensureUserDataDirs();
}

function mountApp(): void {
  createRoot(rootElement as HTMLElement).render(
    <StrictMode>
      {isSoundboardWindow
        ? (AudioSoundboardWindow
            ? <Suspense fallback={null}><AudioSoundboardWindow dbPath={soundboardDbPath} projectDir={soundboardProjectDir} /></Suspense>
            : null)
        : <App />}
    </StrictMode>,
  );
}

// #393: register importable user themes for EVERY window (including the
// detached soundboard/player windows with their own JS context), otherwise an
// active user theme silently degrades there to the default palette.
// #396: if the STORED theme is a built-in, paint immediately and scan in parallel
// (no flash possible). If it is a NON-built-in (user theme, not yet registered at
// this point), scan+apply first, THEN paint — avoids the
// brief default-palette flash.
if (isBuiltinThemeId(getStoredThemeId())) {
  void bootstrapUserThemes();
  mountApp();
} else {
  void bootstrapUserThemes().finally(mountApp);
}
