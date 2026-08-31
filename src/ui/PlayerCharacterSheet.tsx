// M10-S08 (#357): Spieler-Charakterbogen (D13/D14).
// Der Datensatz lebt als base_entities-Row (type='Character') mit
// `is_player_character: true` im properties_json — plus campaign_id und
// player_id als Bindung an genau eine (Campaign, Spieler)-Paarung (D10).
// - Nach dem Join legt der Spieler HIER seinen Charakter an (Basisfelder;
//   plugin-gesteuertes Schema kommt sobald campaigns.system_plugin_id gesetzt
//   wird — Follow-up an M9-S03 #166).
// - Der Bogen ist ausschließlich für den eigenen Spieler editierbar (D20).
// - D13/D14 „Bogen = Aktionsquelle": Aktions-Buttons rufen `onPostAction` auf.
//   Die konkrete Log-Persistenz + Regel-Auflösung leben im Kampf-Sub-Epic
//   (M10b); dieses Sheet liefert den Auslöser + posted-Aktion an den Consumer.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import {
  createPlayerCharacter,
  getPlayerCharacter,
  updatePlayerCharacter,
  type PlayerCharacter,
} from '../services/player-character-service';
import type { PlayClientStoreImpl } from '../services/play-client-store';
import { Button, Field, Panel, StatusChip } from './primitives';

export interface PlayerCharacterSheetProps {
  /** DM-Pfad (Host-DB, volles CRUD). */
  database?: DatabaseLike;
  /** #374 Client-Pfad (Membran D30): Bogen aus dem Store lesen, Edits laufen
   *  später als ClientAction — für jetzt read-only. */
  store?: PlayClientStoreImpl;
  campaignId: string;
  playerId: string;
  displayName?: string;
  onPostAction?: (action: { characterId: string; name: string; text: string }) => void;
}

export function PlayerCharacterSheet({
  database, store, campaignId, playerId, displayName, onPostAction,
}: PlayerCharacterSheetProps) {
  const { t } = useTranslation('multiplayer');
  const [character, setCharacter] = useState<PlayerCharacter | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState(displayName ?? '');
  const [newSummary, setNewSummary] = useState('');
  const [editing, setEditing] = useState(false);
  const [editSummary, setEditSummary] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  // Store-Pfad (Client): read-only aus dem transport-gespeisten Store.
  useEffect(() => {
    if (!store) return;
    const sync = () => {
      const own = store.ownCharacter();
      setCharacter(own ? {
        id: own.id,
        campaign_id: campaignId,
        player_id: playerId,
        sheet: own.data,
      } : null);
      setLoading(false);
    };
    sync();
    return store.subscribe(sync);
  }, [store, campaignId, playerId]);

  // DB-Pfad (DM/Host): volles CRUD.
  useEffect(() => {
    if (!database) return;
    let cancelled = false;
    setLoading(true);
    getPlayerCharacter(database, campaignId, playerId)
      .then((c) => { if (!cancelled) { setCharacter(c); setLoading(false); } })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [database, campaignId, playerId]);

  const readOnly = store !== undefined && database === undefined;

  async function handleCreate() {
    if (!database) return; // Client-Pfad ist read-only.
    setError(null);
    setCreating(true);
    try {
      const c = await createPlayerCharacter(database, {
        campaignId, playerId,
        sheetJson: {
          name: newName.trim(),
          summary: newSummary.trim(),
        },
      });
      setCharacter(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveSummary() {
    if (character === null || !database) return; // Client-Pfad read-only.
    setError(null);
    try {
      const nextSheet = { ...character.sheet, summary: editSummary };
      await updatePlayerCharacter(database, character.id, { sheetJson: nextSheet });
      setCharacter({ ...character, sheet: nextSheet });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function triggerAction(name: string, text: string) {
    if (character === null) return;
    onPostAction?.({ characterId: character.id, name, text });
    setLastAction(text);
    window.setTimeout(() => setLastAction(null), 1500);
  }

  if (loading) {
    return <Panel className="player-character-sheet"><p>{t('pc.loading', 'Lade Charakter…')}</p></Panel>;
  }

  if (character === null) {
    if (readOnly) {
      return (
        <Panel className="player-character-sheet u-stack u-gap-2">
          <h2>{t('pc.createTitle', 'Charakter erstellen')}</h2>
          <p className="u-muted">{t('pc.awaitingHost', 'Warte auf Host — noch kein Bogen freigegeben.')}</p>
        </Panel>
      );
    }
    return (
      <Panel className="player-character-sheet u-stack u-gap-3" role="form"
        aria-label={t('pc.createTitle', 'Charakter erstellen')}>
        <h2>{t('pc.createTitle', 'Charakter erstellen')}</h2>
        <p>{t('pc.createHint', 'Dieser Charakter ist mit deinem Beitritt fest verknüpft (1 Charakter pro Campaign).')}</p>
        <Field
          label={t('pc.nameLabel', 'Name')}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('pc.namePlaceholder', 'z.B. Ada Thorn')}
          autoFocus
        />
        <Field
          label={t('pc.summaryLabel', 'Kurzbeschreibung (optional)')}
          value={newSummary}
          onChange={(e) => setNewSummary(e.target.value)}
          placeholder={t('pc.summaryPlaceholder', 'Archivistin, sucht ihren Bruder …')}
        />
        {error !== null && <StatusChip tone="failure" role="alert">{error}</StatusChip>}
        <Button
          tone="accent"
          disabled={newName.trim() === '' || creating}
          onClick={() => void handleCreate()}
        >
          {creating ? t('pc.creating', 'Erstelle…') : t('pc.create', 'Charakter anlegen')}
        </Button>
      </Panel>
    );
  }

  const charName = typeof character.sheet.name === 'string' ? character.sheet.name : '';
  const charSummary = typeof character.sheet.summary === 'string' ? character.sheet.summary : '';

  return (
    <Panel className="player-character-sheet u-stack u-gap-3" role="region"
      aria-label={t('pc.sheetTitle', 'Charakterbogen')}>
      <h2>{charName || t('pc.unnamed', '(unbenannt)')}</h2>
      {editing ? (
        <div className="u-stack u-gap-2">
          <Field
            label={t('pc.summaryLabel', 'Kurzbeschreibung')}
            value={editSummary}
            onChange={(e) => setEditSummary(e.target.value)}
          />
          <div className="u-row u-gap-2">
            <Button tone="accent" onClick={() => void handleSaveSummary()}>
              {t('save', { ns: 'common' })}
            </Button>
            <Button onClick={() => setEditing(false)}>
              {t('cancel', { ns: 'common' })}
            </Button>
          </div>
        </div>
      ) : (
        <div className="u-stack u-gap-2">
          <p>{charSummary || t('pc.noSummary', '(keine Kurzbeschreibung)')}</p>
          {!readOnly && (
            <Button
              size="compact"
              onClick={() => { setEditSummary(charSummary); setEditing(true); }}
            >
              {t('pc.editSummary', 'Bearbeiten')}
            </Button>
          )}
        </div>
      )}
      <div className="player-character-sheet__actions u-stack u-gap-2">
        <h3>{t('pc.actionsTitle', 'Aktionen')}</h3>
        <p className="u-muted">{t('pc.actionsHint', 'Aktionen posten in den Kampflog (Regel-Auflösung folgt im Kampf-Sub-Epic M10b).')}</p>
        <div className="u-row u-gap-2">
          <Button onClick={() => triggerAction('attack', t('pc.actionAttack', '{{name}} greift an.', { name: charName }))}>
            {t('pc.actionAttackBtn', 'Angriff')}
          </Button>
          <Button onClick={() => triggerAction('cast', t('pc.actionCast', '{{name}} wirkt einen Zauber.', { name: charName }))}>
            {t('pc.actionCastBtn', 'Zauber')}
          </Button>
          <Button onClick={() => triggerAction('skill', t('pc.actionSkill', '{{name}} nutzt eine Fertigkeit.', { name: charName }))}>
            {t('pc.actionSkillBtn', 'Fertigkeit')}
          </Button>
        </div>
        {lastAction !== null && (
          <StatusChip tone="success">{t('pc.actionSent', 'gesendet: {{txt}}', { txt: lastAction })}</StatusChip>
        )}
      </div>
      {error !== null && <StatusChip tone="failure" role="alert">{error}</StatusChip>}
    </Panel>
  );
}

export default PlayerCharacterSheet;
