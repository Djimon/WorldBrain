// M15-S07/#298: Token editor — a rendered React panel (AP-003: no prompt/
// alert/confirm). A token is a map-local design element (NO entity link):
// edits name, image upload + render mode (token mask / plain art), the mask
// crop (drag, token mode only), ring/frame color, the one counter, and status
// chips. On save it hands a full patch to MapViewer, which persists via
// map-token-service.
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Counter, MapTokenRow, StatusChip, TokenRenderStyle } from '../services/map-token-service';
import { getIcon } from '../services/icon-set-registry';
import { IconPicker } from './IconPicker';
import { Button, Panel, Segmented } from './primitives';

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
  counters: Counter[];
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

const MAX_STATUS_CHIPS = 12;
const MAX_COUNTERS = 5;

export function TokenEditor({ token, onPickArt, resolveAssetUrl, onSave, onDelete, onClose }: TokenEditorProps) {
  const { t } = useTranslation('map');
  const [label, setLabel] = useState(token.label ?? '');
  const [ringColor, setRingColor] = useState(token.ring_color ?? '#6ea8fe');
  const [artAssetId, setArtAssetId] = useState(token.art_asset_id);
  const [renderStyle, setRenderStyle] = useState<TokenRenderStyle>(token.render_style);
  const [offX, setOffX] = useState(token.art_offset_x);
  const [offY, setOffY] = useState(token.art_offset_y);
  const [counters, setCounters] = useState<Counter[]>(token.counters);
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

  function addCounter() {
    setCounters((prev) => (prev.length >= MAX_COUNTERS ? prev : [...prev, { label: '', value: 0 }]));
  }
  function removeCounter(i: number) { setCounters((prev) => prev.filter((_, idx) => idx !== i)); }
  function updateCounter(i: number, patch: Partial<Counter>) {
    setCounters((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function updateChip(i: number, patch: Partial<StatusChip>) {
    setChips((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  // #300: 12 chips exactly fill one lap of the 30deg-step token orbit
  // (12 * 30 = 360) — capped so a second lap never starts.
  function addChip() {
    setChips((prev) => (prev.length >= MAX_STATUS_CHIPS ? prev : [...prev, { icon: '', color: '', text: '' }]));
  }
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
      counters: counters.filter((c) => c.label.trim() !== '' || c.value !== 0),
      status_chips: cleanChips,
    });
  }

  const artSrc = artAssetId ? resolveAssetUrl(artAssetId) : null;

  return (
    <Panel variant="popover" className="token-editor u-stack u-gap-2" role="dialog" aria-label={t('token.editorTitle', 'Token bearbeiten')}>
      <div className="token-editor__header">
        <strong>{t('token.editorTitle', 'Token bearbeiten')}</strong>
        <Button variant="ghost" size="icon" onClick={onClose} title={t('close', 'Schließen')}>✕</Button>
      </div>

      <label className="token-editor__field">
        {t('token.label', 'Name')}
        <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>

      <fieldset className="token-editor__art">
        <legend>{t('token.art', 'Bild')}</legend>
        <Segmented
          label={t('token.mode', 'Darstellung')}
          size="compact"
          value={renderStyle}
          onChange={(id) => setRenderStyle(id as TokenRenderStyle)}
          options={[
            { id: 'token', label: t('token.modeToken', 'Token (Kreis)') },
            { id: 'plain', label: t('token.modePlain', 'Plain (ganzes Bild)') },
          ]}
        />
        <Button size="compact" className="token-editor__upload" onClick={() => void pickArt()}>
          {artAssetId ? t('token.replaceArt', 'Bild ersetzen') : t('token.uploadArt', 'Bild hochladen')}
        </Button>

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
        <legend>{t('token.counters', 'Zähler')}</legend>
        {counters.map((c, i) => (
          <div key={i} className="token-editor__counter-row u-row u-gap-1">
            <input type="text" aria-label={t('token.counterLabel', 'Bezeichnung')} placeholder={t('token.counterLabel', 'Bezeichnung')}
              value={c.label} onChange={(e) => updateCounter(i, { label: e.target.value })} />
            <input type="number" aria-label={t('token.counterValue', 'Wert')} placeholder="0"
              value={c.value} onChange={(e) => updateCounter(i, { value: Number(e.target.value) })} />
            <input type="color" aria-label={t('token.counterColor', 'Farbe')}
              value={c.color || '#6ea8fe'} onChange={(e) => updateCounter(i, { color: e.target.value })} />
            <Button variant="ghost" size="compact" onClick={() => removeCounter(i)} title={t('token.removeCounter', 'Zähler entfernen')}>✕</Button>
          </div>
        ))}
        <Button size="compact" className="token-editor__add-counter" onClick={addCounter}
          disabled={counters.length >= MAX_COUNTERS}
          title={counters.length >= MAX_COUNTERS ? t('token.countersMaxed', 'Maximal 5 Zähler') : undefined}>
          {t('token.addCounter', '+ Zähler')}
        </Button>
      </fieldset>

      <fieldset className="token-editor__chips">
        <legend>{t('token.chips', 'Status-Chips')}</legend>
        {chips.map((chip, i) => (
          <div key={i} className="token-editor__chip-row u-row u-gap-1">
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
            <Button variant="ghost" size="compact" onClick={() => removeChip(i)} title={t('token.removeChip', 'Chip entfernen')}>✕</Button>
          </div>
        ))}
        <Button size="compact" className="token-editor__add-chip" onClick={addChip}
          disabled={chips.length >= MAX_STATUS_CHIPS}
          title={chips.length >= MAX_STATUS_CHIPS ? t('token.chipsMaxed', 'Maximal 12 Chips (voller Kreis)') : undefined}>
          {t('token.addChip', '+ Chip')}
        </Button>
      </fieldset>

      <div className="token-editor__actions">
        <Button tone="accent" size="compact" onClick={save}>{t('save', 'Speichern')}</Button>
        <Button tone="danger" variant="outline" size="compact" onClick={onDelete}>{t('token.delete', 'Token löschen')}</Button>
      </div>
    </Panel>
  );
}

export default TokenEditor;
