// M15-S16 (#287): clip (audio-button) editor — source, base volume, label,
// icon, color, loop. A playlist URL is saved as-is, one clip (D5) — this
// editor never decomposes it. Delete uses a rendered confirm (AP-003).
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import {
  createPreset, deletePreset, listPresets, updatePreset,
} from '../services/audio-service';
import type { SourceType } from '../services/audio-service';
import { copyAudioAsset } from '../services/audio-asset';
import { parseSpotifyUri } from '../services/spotify-uri';

const DEFAULT_CLIP_COLOR = '#3a3f45';

const EMOJI_CHOICES = ['🎵', '🌧️', '🔥', '⚔️', '👻', '🐉', '🌊', '🌲', '💀', '🔔', '⚡', '🕯️'];
const COLOR_CHOICES = ['#7b1d1d', '#1d5f7b', '#3c6f3c', '#7b5f1d', '#5f1d7b', '#3a3f45'];

export interface ClipEditorProps {
  database: DatabaseLike;
  projectDir: string;
  channelId: string;
  presetId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ClipEditor({ database, projectDir, channelId, presetId, onClose, onSaved }: ClipEditorProps) {
  const { t } = useTranslation('nav');
  const [loaded, setLoaded] = useState(presetId === null);
  const [sourceType, setSourceType] = useState<SourceType>('file');
  const [sourceRef, setSourceRef] = useState('');
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('🎵');
  const [color, setColor] = useState(DEFAULT_CLIP_COLOR);
  const [baseVolume, setBaseVolume] = useState(1);
  const [loop, setLoop] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (presetId === null) return;
    listPresets(database, channelId).then((presets) => {
      const found = presets.find((p) => p.id === presetId);
      if (found) {
        setSourceType(found.source_type);
        setSourceRef(found.source_ref);
        setLabel(found.label ?? '');
        setIcon(found.icon ?? '🎵');
        setColor(found.color ?? DEFAULT_CLIP_COLOR);
        setBaseVolume(found.base_volume);
        setLoop(!!found.loop);
      }
      setLoaded(true);
    }).catch(console.error);
  }, [database, channelId, presetId]);

  async function handlePickFile() {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      filters: [{ name: t('audioClipAudioFiles', 'Audio'), extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac'] }],
      multiple: false,
    });
    if (typeof selected !== 'string') return;
    const basename = selected.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? 'clip';
    const destPath = await copyAudioAsset(selected, projectDir, `${basename}_${crypto.randomUUID().slice(0, 8)}`);
    setSourceRef(destPath);
    setLabel((current) => current || basename);
  }

  async function handleSave() {
    const normalizedRef = sourceType === 'spotify' ? (parseSpotifyUri(sourceRef) ?? sourceRef) : sourceRef;
    const patch = { source_type: sourceType, source_ref: normalizedRef, base_volume: baseVolume, label, icon, color, loop };
    if (presetId === null) {
      await createPreset(database, { channel_id: channelId, ...patch });
    } else {
      await updatePreset(database, presetId, patch);
    }
    onSaved();
    onClose();
  }

  async function handleConfirmDelete() {
    if (presetId) await deletePreset(database, presetId);
    setConfirmDelete(false);
    onSaved();
    onClose();
  }

  if (!loaded) {
    return <div className="clip-editor">{t('audioSoundboardLoading', 'Lade…')}</div>;
  }

  if (confirmDelete) {
    return (
      <div className="clip-editor" role="dialog" aria-label={t('audioClipConfirmDeleteTitle', 'Clip löschen?')}>
        <p>{t('audioClipConfirmDeleteBody', 'Der Clip wird gelöscht.')}</p>
        <div className="clip-editor__actions">
          <button type="button" className="btn btn--primary" onClick={() => void handleConfirmDelete()}>
            {t('audioClipConfirmDeleteAction', 'Löschen')}
          </button>
          <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>
            {t('audioSceneCancel', 'Abbrechen')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="clip-editor" role="dialog" aria-label={t('audioClipEditorTitle', 'Clip bearbeiten')}>
      <label>
        {t('audioClipSourceType', 'Quelle')}
        <select value={sourceType} onChange={(e) => setSourceType(e.target.value as SourceType)}>
          <option value="file">{t('audioClipSourceFile', 'Lokale Datei')}</option>
          <option value="link">{t('audioClipSourceLink', 'Link (YouTube)')}</option>
          <option value="spotify">{t('audioClipSourceSpotify', 'Spotify (nur An/Aus)')}</option>
        </select>
      </label>

      {sourceType === 'file' ? (
        <div className="clip-editor__source-file">
          <button type="button" className="btn" onClick={() => void handlePickFile()}>
            {t('audioClipPickFile', 'Datei wählen…')}
          </button>
          {sourceRef && <span className="clip-editor__source-path">{sourceRef}</span>}
        </div>
      ) : sourceType === 'link' ? (
        <label>
          {t('audioClipSourceUrl', 'URL')}
          <input
            type="text" value={sourceRef} placeholder="https://www.youtube.com/watch?v=…"
            onChange={(e) => setSourceRef(e.target.value)}
          />
        </label>
      ) : (
        <label>
          {t('audioClipSourceSpotifyUrl', 'Spotify-Link oder -URI')}
          <input
            type="text" value={sourceRef} placeholder="https://open.spotify.com/track/… oder spotify:track:…"
            onChange={(e) => setSourceRef(e.target.value)}
          />
        </label>
      )}

      <label>
        {t('audioClipLabel', 'Name')}
        <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>

      <label>
        {t('audioClipBaseVolume', 'Basis-Lautstärke')}
        <input type="range" min={0} max={1} step={0.01} value={baseVolume} onChange={(e) => setBaseVolume(Number(e.target.value))} />
        <span>{Math.round(baseVolume * 100)}%</span>
      </label>

      <div className="clip-editor__icon-picker" role="group" aria-label={t('audioClipIcon', 'Icon')}>
        {t('audioClipIcon', 'Icon')}
        {EMOJI_CHOICES.map((emoji) => (
          <button
            key={emoji} type="button" aria-pressed={icon === emoji}
            aria-label={emoji} onClick={() => setIcon(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className="clip-editor__color-picker" role="group" aria-label={t('audioClipColor', 'Farbe')}>
        <input type="color" value={color} aria-label={t('audioClipColor', 'Farbe')} onChange={(e) => setColor(e.target.value)} />
        {COLOR_CHOICES.map((swatch) => (
          <button
            key={swatch} type="button" className="clip-editor__color-swatch"
            style={{ backgroundColor: swatch }} aria-label={swatch} aria-pressed={color === swatch}
            onClick={() => setColor(swatch)}
          />
        ))}
      </div>

      {sourceType === 'file' && (
        <label>
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
          {t('audioClipLoop', 'Endlos wiederholen')}
        </label>
      )}

      <div className="clip-editor__actions">
        <button type="button" className="btn btn--primary" disabled={!sourceRef.trim()} onClick={() => void handleSave()}>
          {t('audioClipSave', 'Speichern')}
        </button>
        <button type="button" className="btn" onClick={onClose}>
          {t('audioSceneCancel', 'Abbrechen')}
        </button>
        {presetId !== null && (
          <button type="button" className="btn" onClick={() => setConfirmDelete(true)}>
            {t('audioClipDelete', 'Löschen')}
          </button>
        )}
      </div>
    </div>
  );
}
