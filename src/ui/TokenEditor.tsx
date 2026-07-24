// M15-S07/#298: Token editor — a rendered React panel (AP-003: no prompt/
// alert/confirm). A token is a map-local design element (NO entity link):
// edits name, image upload + render mode (token mask / plain art), the mask
// crop (drag, token mode only), ring/frame color, the one counter, and status
// chips. On save it hands a full patch to MapViewer, which persists via
// map-token-service.
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MapTokenRow, StatusChip, TokenRenderStyle } from '../services/map-token-service';
import { getIcon } from '../services/icon-set-registry';
import { IconPicker } from './IconPicker';

// #300: chip.icon may be a registry ref ("set_id:icon_key") or a legacy
// literal glyph string (no colon -> getIcon returns undefined, falls back
// to showing the raw string as before — backward compatible).
function ChipIconTriggerContent({ icon }: { icon: string }) {
  const resolved = icon ? getIcon(icon) : undefined;
  if (!resolved) return <>{icon}</>;
  if (resolved.svg) return <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: resolved.svg }} />;
  if (resolved.src) return <img src={resolved.src} alt="" aria-hidden="true" />;
  return <>{resolved.glyph}</>;
}

export interface TokenEditPatch {
  label: string;
  ring_color: string | null;
  art_asset_id: string | null;
  render_style: TokenRenderStyle;
  art_offset_x: number;
  art_offset_y: number;
  counter_label: string | null;
  counter_value: number | null;
  status_chips: StatusChip[];
}

export interface TokenEditorProps {
  token: MapTokenRow;
  /** Opens the Tauri file dialog, copies the image, returns the asset id (or null). */
  onPickArt: () => Promise<string | null>;
  resolveAssetUrl: (assetId: string) => string;
  onSave: (patch: TokenEditPatch) => void;
  onDelete: () => void;
  onClose: () => void;
}

function clampPct(v: number): number {
  return Math.max(-50, Math.min(50, v));
}

export function TokenEditor({ token, onPickArt, resolveAssetUrl, onSave, onDelete, onClose }: TokenEditorProps) {
  const { t } = useTranslation('map');
  const [label, setLabel] = useState(token.label ?? '');
  const [ringColor, setRingColor] = useState(token.ring_color ?? '#6ea8fe');
  const [artAssetId, setArtAssetId] = useState(token.art_asset_id);
  const [renderStyle, setRenderStyle] = useState<TokenRenderStyle>(token.render_style);
  const [offX, setOffX] = useState(token.art_offset_x);
  const [offY, setOffY] = useState(token.art_offset_y);
  const [counterLabel, setCounterLabel] = useState(token.counter_label ?? '');
  const [counterValue, setCounterValue] = useState(token.counter_value != null ? String(token.counter_value) : '');
  const [chips, setChips] = useState<StatusChip[]>(token.status_chips);
  const [openPickerIndex, setOpenPickerIndex] = useState<number | null>(null);

  const cropRef = useRef<HTMLDivElement | null>(null);
  const dragStart = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  async function pickArt() {
    const id = await onPickArt();
    if (id) setArtAssetId(id);
  }

  // Drag inside the crop circle pans the visible section (token mode).
  function onCropDown(e: React.PointerEvent<HTMLDivElement>) {
    if (renderStyle !== 'token' || !artAssetId) return;
    dragStart.current = { px: e.clientX, py: e.clientY, ox: offX, oy: offY };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* jsdom */ }
  }
  function onCropMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return;
    const box = cropRef.current?.getBoundingClientRect();
    const size = box?.width || 140;
    const dx = ((e.clientX - dragStart.current.px) / size) * 100;
    const dy = ((e.clientY - dragStart.current.py) / size) * 100;
    setOffX(clampPct(dragStart.current.ox + dx));
    setOffY(clampPct(dragStart.current.oy + dy));
  }
  function onCropUp() { dragStart.current = null; }

  function updateChip(i: number, patch: Partial<StatusChip>) {
    setChips((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function addChip() { setChips((prev) => [...prev, { icon: '', color: '', text: '' }]); }
  function removeChip(i: number) { setChips((prev) => prev.filter((_, idx) => idx !== i)); }

  function save() {
    const cleanChips = chips
      .filter((c) => c.icon.trim() !== '')
      .map((c) => ({ icon: c.icon, ...(c.color ? { color: c.color } : {}), ...(c.text ? { text: c.text } : {}) }));
    onSave({
      label,
      ring_color: ringColor || null,
      art_asset_id: artAssetId,
      render_style: renderStyle,
      art_offset_x: offX,
      art_offset_y: offY,
      counter_label: counterLabel || null,
      counter_value: counterValue.trim() === '' ? null : Number(counterValue),
      status_chips: cleanChips,
    });
  }

  const artSrc = artAssetId ? resolveAssetUrl(artAssetId) : null;

  return (
    <div className="token-editor" role="dialog" aria-label={t('token.editorTitle', 'Token bearbeiten')}>
      <div className="token-editor__header">
        <strong>{t('token.editorTitle', 'Token bearbeiten')}</strong>
        <button type="button" className="token-editor__close" onClick={onClose} title={t('close', 'Schließen')}>✕</button>
      </div>

      <label className="token-editor__field">
        {t('token.label', 'Name')}
        <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>

      <fieldset className="token-editor__art">
        <legend>{t('token.art', 'Bild')}</legend>
        <div className="token-editor__mode">
          <button type="button" className={`token-editor__mode-btn${renderStyle === 'token' ? ' active' : ''}`}
            aria-pressed={renderStyle === 'token'} onClick={() => setRenderStyle('token')}>
            {t('token.modeToken', 'Token (Kreis)')}
          </button>
          <button type="button" className={`token-editor__mode-btn${renderStyle === 'plain' ? ' active' : ''}`}
            aria-pressed={renderStyle === 'plain'} onClick={() => setRenderStyle('plain')}>
            {t('token.modePlain', 'Plain (ganzes Bild)')}
          </button>
        </div>
        <button type="button" className="token-editor__upload" onClick={() => void pickArt()}>
          {artAssetId ? t('token.replaceArt', 'Bild ersetzen') : t('token.uploadArt', 'Bild hochladen')}
        </button>

        {artSrc && renderStyle === 'token' && (
          <div
            ref={cropRef}
            className="token-editor__crop"
            title={t('token.cropHint', 'Ziehen, um den Ausschnitt zu verschieben')}
            onPointerDown={onCropDown}
            onPointerMove={onCropMove}
            onPointerUp={onCropUp}
          >
            <img src={artSrc} alt="" draggable={false}
              style={{ objectFit: 'cover', width: '100%', height: '100%', objectPosition: `${50 + offX}% ${50 + offY}%` }} />
          </div>
        )}
        {artSrc && renderStyle === 'plain' && (
          <div className="token-editor__plain-preview">
            <img src={artSrc} alt="" draggable={false} />
          </div>
        )}
      </fieldset>

      <label className="token-editor__field">
        {t('token.ringColor', 'Rahmenfarbe')}
        <input type="color" aria-label={t('token.ringColor', 'Rahmenfarbe')} value={ringColor} onChange={(e) => setRingColor(e.target.value)} />
      </label>

      <fieldset className="token-editor__counter">
        <legend>{t('token.counter', 'Zähler')}</legend>
        <input type="text" aria-label={t('token.counterLabel', 'Zähler-Bezeichnung')} placeholder={t('token.counterLabel', 'Zähler-Bezeichnung')}
          value={counterLabel} onChange={(e) => setCounterLabel(e.target.value)} />
        <input type="number" aria-label={t('token.counterValue', 'Zähler-Wert')} placeholder="0"
          value={counterValue} onChange={(e) => setCounterValue(e.target.value)} />
        {(counterLabel || counterValue) && (
          <button type="button" className="token-editor__counter-clear"
            onClick={() => { setCounterLabel(''); setCounterValue(''); }}>
            {t('token.clearCounter', 'Zähler entfernen')}
          </button>
        )}
      </fieldset>

      <fieldset className="token-editor__chips">
        <legend>{t('token.chips', 'Status-Chips')}</legend>
        {chips.map((chip, i) => (
          <div key={i} className="token-editor__chip-row">
            <button type="button" className="token-editor__chip-icon-trigger"
              aria-label={t('token.chipIconPicker', 'Symbol wählen')}
              onClick={() => setOpenPickerIndex(openPickerIndex === i ? null : i)}>
              <ChipIconTriggerContent icon={chip.icon} />
            </button>
            {openPickerIndex === i && (
              <div className="token-editor__chip-icon-popover">
                <IconPicker
                  value={chip.icon || null}
                  onSelect={(ref) => {
                    // Pre-fills the chip's text with the condition's name —
                    // only when the text is still empty, so it never
                    // overwrites something the user already typed.
                    const label = getIcon(ref)?.label;
                    updateChip(i, { icon: ref, ...(!chip.text && label ? { text: label } : {}) });
                    setOpenPickerIndex(null);
                  }}
                />
              </div>
            )}
            <input type="text" aria-label={t('token.chipText', 'Chip-Text')} placeholder={t('token.chipText', 'Chip-Text')}
              value={chip.text ?? ''} onChange={(e) => updateChip(i, { text: e.target.value })} />
            <input type="color" aria-label={t('token.chipColor', 'Chip-Farbe')}
              value={chip.color || '#ffffff'} onChange={(e) => updateChip(i, { color: e.target.value })} />
            <button type="button" onClick={() => removeChip(i)} title={t('token.removeChip', 'Chip entfernen')}>✕</button>
          </div>
        ))}
        <button type="button" className="token-editor__add-chip" onClick={addChip}>
          {t('token.addChip', '+ Chip')}
        </button>
      </fieldset>

      <div className="token-editor__actions">
        <button type="button" className="token-editor__save" onClick={save}>{t('save', 'Speichern')}</button>
        <button type="button" className="token-editor__delete" onClick={onDelete}>{t('token.delete', 'Token löschen')}</button>
      </div>
    </div>
  );
}

export default TokenEditor;
