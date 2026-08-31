// M10-S16 (#362): Würfel-Widget im Kampflog-Reiter (D17).
// Nutzer gibt eine Expression (z.B. `2d6+3`) ein, wählt die Sichtbarkeit
// (Privat / DM / Alle), klickt Würfeln → das Ergebnis wird per
// combat-log-service.postEntry persistiert; der Log darüber (in
// KampflogPane) rerendert.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { roll, type DiceVisibility } from '../services/dice-roller-service';
import { postEntry } from '../services/combat-log-service';
import { Button, Field, StatusChip } from './primitives';

export interface DiceRollerWidgetProps {
  database: DatabaseLike;
  campaignId: string;
  actorDisplay: string;
  actorPlayerId?: string;
  onPosted?: () => void;
}

export function DiceRollerWidget({
  database, campaignId, actorDisplay, actorPlayerId, onPosted,
}: DiceRollerWidgetProps) {
  const { t } = useTranslation('multiplayer');
  const [expr, setExpr] = useState('1d20');
  const [visibility, setVisibility] = useState<DiceVisibility>('all');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleRoll() {
    setError(null);
    setBusy(true);
    try {
      const result = await roll(expr, { visibility });
      const text = `${actorDisplay}: ${expr} → [${result.dice.join(', ')}]${result.modifier !== 0 ? ` (${result.modifier > 0 ? '+' : ''}${result.modifier})` : ''} = ${result.total}`;
      await postEntry(database, {
        campaignId, actorDisplay, actorPlayerId, text, visibility,
      });
      onPosted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dice-roller-widget u-stack u-gap-2">
      <div className="u-row u-gap-2">
        <Field
          label={t('dice.expression', 'Ausdruck')}
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          placeholder="1d20+5"
        />
        <label className="u-row u-gap-2">
          <span>{t('dice.visibility', 'Sichtbarkeit')}:</span>
          <select
            aria-label={t('dice.visibility', 'Sichtbarkeit')}
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as DiceVisibility)}
          >
            <option value="all">{t('all', { ns: 'common' })}</option>
            <option value="dm_only">{t('dice.visDm', 'Nur DM')}</option>
            <option value="private">{t('dice.visPrivate', 'Privat')}</option>
          </select>
        </label>
        <Button tone="accent" disabled={busy || expr.trim() === ''} onClick={() => void handleRoll()}>
          {busy ? t('dice.rolling', 'Würfle…') : t('dice.roll', 'Würfeln')}
        </Button>
      </div>
      {error !== null && <StatusChip tone="failure" role="alert">{error}</StatusChip>}
    </div>
  );
}

export default DiceRollerWidget;
