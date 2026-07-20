// M15-S07: Token editor (#279) — a rendered React panel (AP-003: no prompt/
// alert/confirm). Edits label, entity link, ring color, the one counter
// (label + value), and add/remove status chips. On save it hands a full patch
// back to MapViewer, which persists via the map-token-service functions.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MapTokenRow, StatusChip } from '../services/map-token-service';

export interface TokenEditPatch {
  label: string;
  entity_id: string | null;
  ring_color: string | null;
  counter_label: string | null;
  counter_value: number | null;
  status_chips: StatusChip[];
}

export interface TokenEditorProps {
  token: MapTokenRow;
  entities: { id: string; type: string; title: string }[];
  onSave: (patch: TokenEditPatch) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function TokenEditor({ token, entities, onSave, onDelete, onClose }: TokenEditorProps) {
  const { t } = useTranslation('map');
  const [label, setLabel] = useState(token.label ?? '');
  const [entityId, setEntityId] = useState(token.entity_id ?? '');
  const [ringColor, setRingColor] = useState(token.ring_color ?? '#6ea8fe');
  const [counterLabel, setCounterLabel] = useState(token.counter_label ?? '');
  const [counterValue, setCounterValue] = useState(token.counter_value != null ? String(token.counter_value) : '');
  const [chips, setChips] = useState<StatusChip[]>(token.status_chips);

  function updateChip(i: number, patch: Partial<StatusChip>) {
    setChips((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function addChip() {
    setChips((prev) => [...prev, { icon: '', color: '', text: '' }]);
  }
  function removeChip(i: number) {
    setChips((prev) => prev.filter((_, idx) => idx !== i));
  }

  function save() {
    const cleanChips = chips
      .filter((c) => c.icon.trim() !== '')
      .map((c) => ({ icon: c.icon, ...(c.color ? { color: c.color } : {}), ...(c.text ? { text: c.text } : {}) }));
    onSave({
      label,
      entity_id: entityId || null,
      ring_color: ringColor || null,
      counter_label: counterLabel || null,
      counter_value: counterValue.trim() === '' ? null : Number(counterValue),
      status_chips: cleanChips,
    });
  }

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

      <label className="token-editor__field">
        {t('token.entity', 'Verknüpfte Entität')}
        <select value={entityId} onChange={(e) => setEntityId(e.target.value)}>
          <option value="">{t('token.noEntity', '— keine —')}</option>
          {entities.map((ent) => (
            <option key={ent.id} value={ent.id}>{ent.title}</option>
          ))}
        </select>
      </label>

      <label className="token-editor__field">
        {t('token.ringColor', 'Ringfarbe')}
        <input type="color" aria-label={t('token.ringColor', 'Ringfarbe')} value={ringColor} onChange={(e) => setRingColor(e.target.value)} />
      </label>

      <fieldset className="token-editor__counter">
        <legend>{t('token.counter', 'Zähler')}</legend>
        <input type="text" aria-label={t('token.counterLabel', 'Zähler-Bezeichnung')} placeholder={t('token.counterLabel', 'Zähler-Bezeichnung')}
          value={counterLabel} onChange={(e) => setCounterLabel(e.target.value)} />
        <input type="number" aria-label={t('token.counterValue', 'Zähler-Wert')} placeholder="0"
          value={counterValue} onChange={(e) => setCounterValue(e.target.value)} />
      </fieldset>

      <fieldset className="token-editor__chips">
        <legend>{t('token.chips', 'Status-Chips')}</legend>
        {chips.map((chip, i) => (
          <div key={i} className="token-editor__chip-row">
            <input type="text" aria-label={t('token.chipIcon', 'Chip-Symbol')} placeholder="⚡"
              value={chip.icon} onChange={(e) => updateChip(i, { icon: e.target.value })} />
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
