// M15-S14 (#285): one Streamdeck-style clip tile — emoji icon + label +
// colored background (concept art: _design/soundboard concept.png). An
// empty slot renders as a dashed "+" that opens the clip editor (S16). The
// edit affordance is a sibling button, not nested inside the trigger button
// (invalid to nest interactive elements).
import { useTranslation } from 'react-i18next';
import type { AudioPresetRow } from '../services/audio-service';

const DEFAULT_CLIP_COLOR = '#3a3f45';

export interface ClipButtonProps {
  preset: AudioPresetRow | null;
  active: boolean;
  onTrigger: () => void;
  onEdit: () => void;
}

export function ClipButton({ preset, active, onTrigger, onEdit }: ClipButtonProps) {
  const { t } = useTranslation('nav');

  if (!preset) {
    return (
      <button
        type="button"
        className="clip-button clip-button--empty"
        aria-label={t('audioClipAdd', 'Clip hinzufügen')}
        title={t('audioClipAdd', 'Clip hinzufügen')}
        onClick={onEdit}
      >
        +
      </button>
    );
  }

  return (
    <div className="clip-button-wrap">
      <button
        type="button"
        className="clip-button"
        style={{ backgroundColor: preset.color ?? DEFAULT_CLIP_COLOR }}
        aria-pressed={active}
        title={preset.label ?? ''}
        onClick={onTrigger}
      >
        <span className="clip-button__icon" aria-hidden="true">{preset.icon ?? '🎵'}</span>
        <span className="clip-button__label">{preset.label || t('audioClipUnnamed', 'Ohne Namen')}</span>
      </button>
      <button
        type="button"
        className="clip-button__edit"
        aria-label={t('audioClipEdit', 'Clip bearbeiten')}
        title={t('audioClipEdit', 'Clip bearbeiten')}
        onClick={onEdit}
      >
        ✎
      </button>
    </div>
  );
}
