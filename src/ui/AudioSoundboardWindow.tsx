// EPIC-024 (M15 audio soundboard): root component for the detached
// soundboard WebviewWindow (D1 — own AudioContext, separate from the main
// workspace window). Channels/clips/scenes land in M15-S10..S16; this is the
// window shell so the launcher button in WorkspaceShell has somewhere to go.
import { useTranslation } from 'react-i18next';

export function AudioSoundboardWindow() {
  const { t } = useTranslation('nav');

  return (
    <div className="audio-soundboard-window">
      <h1>{t('audioSoundboardWindowTitle', 'Audio-Soundboard')}</h1>
      <p>{t('audioSoundboardPlaceholder', 'Wird in den nächsten Storys gebaut (M15-S10 ff.).')}</p>
    </div>
  );
}
