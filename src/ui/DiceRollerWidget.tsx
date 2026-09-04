// M10-S16 (#362) + S3 (#422): Dice widget in the combat-log view (D17).
// The user enters an expression (e.g. `2d6+3`), selects the visibility
// (Private / DM / All), clicks Roll → the result is persisted.
//   - DM mode (`database`): postEntry writes the host DB directly.
//   - Player mode (`transport`+`senderPlayerId`, D30, no DB): all|dm_only → a `roll_dice`
//     intent to the host (which persists + broadcasts 'all'); 'private' stays local.
//     Own non-'all' rolls are surfaced via `onLocalRoll` (optimistic echo — they never
//     come back over the transport). 'all' rolls arrive back via the host broadcast.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import type { SessionTransport } from '../services/session-transport';
import { roll, type DiceVisibility } from '../services/dice-roller-service';
import { postEntry, type CombatLogEntry } from '../services/combat-log-service';
import { sendRollIntent } from '../services/host-combat-log-sync';
import { Button, Field, StatusChip } from './primitives';

export interface DiceRollerWidgetProps {
  campaignId: string;
  actorDisplay: string;
  actorPlayerId?: string;
  /** DM mode — persist directly to the host DB. */
  database?: DatabaseLike;
  /** DM mode — the posted entry (caller broadcasts it to the players + reloads the log). */
  onPosted?: (entry: CombatLogEntry) => void;
  /** Player mode — send the roll as a host intent (no local DB, D30). */
  transport?: Pick<SessionTransport, 'send'>;
  /** Player mode — the sender's player id (host authorizes membership itself). */
  senderPlayerId?: string;
  /** Player mode — own dm_only/private rolls to show optimistically (never echoed back). */
  onLocalRoll?: (entry: CombatLogEntry) => void;
}

export function DiceRollerWidget({
  database, campaignId, actorDisplay, actorPlayerId, onPosted,
  transport, senderPlayerId, onLocalRoll,
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
      if (database !== undefined) {
        // DM: ground truth straight into the host DB.
        const entry = await postEntry(database, { campaignId, actorDisplay, actorPlayerId, text, visibility });
        onPosted?.(entry);
      } else if (transport !== undefined && senderPlayerId !== undefined) {
        // Player (D30): all|dm_only → host intent; 'private' stays purely local.
        if (visibility === 'all' || visibility === 'dm_only') {
          sendRollIntent(transport, { campaignId, senderPlayerId, actorDisplay, text, visibility });
        }
        // 'all' comes back via the host broadcast → echo only the non-'all' own rolls.
        if (visibility !== 'all') {
          onLocalRoll?.({
            id: `local_${crypto.randomUUID()}`, campaign_id: campaignId,
            actor_display: actorDisplay, actor_player_id: senderPlayerId,
            text, visibility, created_at: new Date().toISOString(),
          });
        }
      }
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
