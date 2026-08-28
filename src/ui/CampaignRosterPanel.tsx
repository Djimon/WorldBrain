// M10-S24 (#347): Campaign-Mitglieder-Panel — persistente Roster-Verwaltung
// im Bearbeiten-Modus. Anders als die Live-Lobby (S06, im Play-Cockpit) zeigt
// dieses Panel ALLE Mitglieder (aktive + gekickte), erlaubt Gruppen-Zuordnung
// und Code-Regeneration. Datenmodell = dasselbe wie S06 (campaign_id-scoped).
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import {
  createCampaign, listCampaigns,
  type Campaign,
} from '../services/campaign-service';
import {
  kick as kickPlayer, listCampaignPlayers,
  type SessionPlayer,
} from '../services/player-membership-service';
import { generateInviteCode, getActiveInviteCode } from '../services/session-identity-service';
import {
  addMember, createGroup, deleteGroup, listGroups, removeMember, renameGroup,
  type PlayerGroup,
} from '../services/player-groups-service';
import { Button, Field, ListSurface, Panel, StatusChip } from './primitives';
import { CampaignLog } from './CampaignLog';

export interface CampaignRosterPanelProps {
  database: DatabaseLike;
  /** Wenn gesetzt: dieser Panel-Mount ist auf eine Campaign fixiert. Sonst
   *  zeigt das Panel eine Auswahl-Dropdown + „neue Campaign anlegen". */
  campaignId?: string;
}

interface MemberGroupMap { [playerId: string]: string[] }

export function CampaignRosterPanel({ database, campaignId: fixedCampaignId }: CampaignRosterPanelProps) {
  const { t } = useTranslation('multiplayer');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(fixedCampaignId ?? '');
  const [newCampaignTitle, setNewCampaignTitle] = useState('');
  const [players, setPlayers] = useState<SessionPlayer[]>([]);
  const [groups, setGroups] = useState<PlayerGroup[]>([]);
  const [memberGroups, setMemberGroups] = useState<MemberGroupMap>({});
  const [inviteCode, setInviteCode] = useState<string>('');
  const [newGroupName, setNewGroupName] = useState('');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initial: Campaigns laden. Ohne fixedCampaignId Vor-Auswahl auf erste.
  useEffect(() => {
    let cancelled = false;
    listCampaigns(database).then((cs) => {
      if (cancelled) return;
      setCampaigns(cs);
      if (fixedCampaignId === undefined && selectedCampaignId === '' && cs.length > 0) {
        setSelectedCampaignId(cs[0].id);
      }
    }).catch((e) => setError(e instanceof Error ? e.message : String(e)));
    return () => { cancelled = true; };
  }, [database, fixedCampaignId]);

  // Roster + Gruppen für aktive Campaign laden.
  async function reload() {
    if (selectedCampaignId === '') return;
    try {
      const [ps, gs] = await Promise.all([
        listCampaignPlayers(database, selectedCampaignId),
        listGroups({ database, campaignId: selectedCampaignId }),
      ]);
      setPlayers(ps);
      setGroups(gs);
      // Pro Player die Group-Membership sammeln (kleine Fanning-out-Query).
      const map: MemberGroupMap = {};
      for (const p of ps) {
        const rows = await database.select<{ group_id: string }>(
          'SELECT group_id FROM group_members WHERE player_id = ?',
          [p.player_id],
        );
        map[p.player_id] = rows.map((r) => r.group_id);
      }
      setMemberGroups(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  useEffect(() => { void reload(); }, [database, selectedCampaignId]);

  // #371 Fix 1/2: aktiven Code laden statt still neu generieren.
  useEffect(() => {
    if (selectedCampaignId === '') { setInviteCode(''); return; }
    let cancelled = false;
    void getActiveInviteCode(database, selectedCampaignId).then((code) => {
      if (cancelled) return;
      setInviteCode(code ?? '');
    }).catch(() => { /* fail-open */ });
    return () => { cancelled = true; };
  }, [database, selectedCampaignId]);

  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameGroupValue, setRenameGroupValue] = useState('');

  async function submitRenameGroup(groupId: string) {
    if (renameGroupValue.trim() === '') { setRenamingGroupId(null); return; }
    setError(null);
    try {
      await renameGroup({ database, groupId, name: renameGroupValue.trim() });
      setRenamingGroupId(null);
      setRenameGroupValue('');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDeleteGroup(groupId: string) {
    setError(null);
    try {
      await deleteGroup({ database, groupId });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleCreateCampaign() {
    if (newCampaignTitle.trim() === '') return;
    setError(null);
    try {
      const c = await createCampaign(database, { title: newCampaignTitle.trim() });
      setNewCampaignTitle('');
      const cs = await listCampaigns(database);
      setCampaigns(cs);
      setSelectedCampaignId(c.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleKick(playerId: string) {
    setError(null);
    try {
      await kickPlayer(database, { campaignId: selectedCampaignId, playerId });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleRegenerate() {
    setError(null);
    try {
      const next = await generateInviteCode(database, { campaignId: selectedCampaignId });
      setInviteCode(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleCopy() {
    if (inviteCode === '') return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopyFeedback(t('roster.copied', 'kopiert'));
      window.setTimeout(() => setCopyFeedback(null), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleCreateGroup() {
    if (newGroupName.trim() === '' || selectedCampaignId === '') return;
    setError(null);
    try {
      await createGroup({ database, campaignId: selectedCampaignId, name: newGroupName.trim() });
      setNewGroupName('');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function toggleMemberGroup(playerId: string, groupId: string) {
    const current = memberGroups[playerId] ?? [];
    setError(null);
    try {
      if (current.includes(groupId)) {
        await removeMember({ database, groupId, playerId });
      } else {
        await addMember({ database, groupId, playerId });
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const activeCampaign = campaigns.find((c) => c.id === selectedCampaignId) ?? null;

  return (
    <Panel className="campaign-roster-panel u-stack u-gap-3" role="region"
      aria-label={t('roster.title', 'Campaign-Mitglieder')}>
      <h2>{t('roster.title', 'Campaign-Mitglieder')}</h2>

      {fixedCampaignId === undefined && (
        <div className="u-stack u-gap-2">
          <label className="u-row u-gap-2">
            <span>{t('roster.selectCampaign', 'Campaign:')}</span>
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              aria-label={t('roster.selectCampaign', 'Campaign:')}
            >
              <option value="">{t('roster.noneSelected', '— wählen —')}</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </label>
          {/* #371 Fix 4: Neue-Campaign-Form nur wenn KEINE ausgewählt/vorhanden. */}
          {selectedCampaignId === '' && (
            <div className="u-row u-gap-2">
              <Field
                label={t('roster.newCampaignLabel', 'Neue Campaign')}
                value={newCampaignTitle}
                onChange={(e) => setNewCampaignTitle(e.target.value)}
                placeholder={t('roster.newCampaignPlaceholder', 'Titel')}
              />
              <Button tone="accent" disabled={newCampaignTitle.trim() === ''} onClick={() => void handleCreateCampaign()}>
                {t('roster.createCampaign', 'Anlegen')}
              </Button>
            </div>
          )}
        </div>
      )}

      {selectedCampaignId !== '' && activeCampaign !== null && (
        <>
          <div className="u-stack u-gap-2">
            <Field
              label={t('roster.inviteLabel', 'Einladungscode')}
              value={inviteCode}
              readOnly
              onChange={() => { /* readonly */ }}
            />
            <div className="u-row u-gap-2">
              <Button tone="accent" onClick={() => void handleCopy()} disabled={inviteCode === ''}>
                {t('roster.copy', 'Kopieren')}
              </Button>
              <Button onClick={() => void handleRegenerate()}>
                {t('roster.regenerate', 'Neu generieren')}
              </Button>
              {copyFeedback !== null && <StatusChip tone="success">{copyFeedback}</StatusChip>}
            </div>
          </div>

          <div className="u-stack u-gap-2">
            <h3>{t('roster.groupsTitle', 'Gruppen')}</h3>
            <div className="u-row u-gap-2">
              <Field
                label={t('roster.newGroupLabel', 'Neue Gruppe')}
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder={t('roster.newGroupPlaceholder', 'Name')}
              />
              <Button disabled={newGroupName.trim() === ''} onClick={() => void handleCreateGroup()}>
                {t('roster.createGroup', 'Anlegen')}
              </Button>
            </div>
            {groups.length === 0 && <p className="u-muted">{t('roster.noGroups', 'Noch keine Gruppen.')}</p>}
            {/* #371 Fix 3: Gruppen-Liste sichtbar (Umbenennen/Löschen). */}
            {groups.length > 0 && (
              <ListSurface className="campaign-roster-panel__groups">
                {groups.map((g) => (
                  <li key={g.id} className="u-row u-gap-2">
                    {renamingGroupId === g.id ? (
                      <>
                        <Field
                          label={t('roster.renameGroupLabel', 'Neuer Name')}
                          value={renameGroupValue}
                          onChange={(e) => setRenameGroupValue(e.target.value)}
                          autoFocus
                        />
                        <Button size="compact" tone="accent" onClick={() => void submitRenameGroup(g.id)}>
                          {t('save', 'Speichern')}
                        </Button>
                        <Button size="compact" onClick={() => setRenamingGroupId(null)}>
                          {t('cancel', 'Abbrechen')}
                        </Button>
                      </>
                    ) : (
                      <>
                        <strong>{g.name}</strong>
                        <Button size="compact" variant="outline"
                          onClick={() => { setRenamingGroupId(g.id); setRenameGroupValue(g.name); }}>
                          {t('roster.renameGroup', 'Umbenennen')}
                        </Button>
                        <Button size="compact" tone="danger" variant="outline"
                          onClick={() => void handleDeleteGroup(g.id)}>
                          {t('roster.deleteGroup', 'Löschen')}
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ListSurface>
            )}
          </div>

          <div className="u-stack u-gap-2">
            <h3>{t('roster.membersTitle', 'Mitglieder')}</h3>
            <ListSurface>
              {players.length === 0 && (
                <li className="campaign-roster-panel__empty">{t('roster.empty', 'Noch keine Mitglieder.')}</li>
              )}
              {players.map((p) => (
                <li key={p.id} className="campaign-roster-panel__row u-stack u-gap-1">
                  <div className="u-row u-gap-2">
                    <span>{p.player_id}</span>
                    <StatusChip tone={p.status === 'active' ? 'success' : 'muted'}>
                      {p.status === 'active' ? t('roster.active', 'aktiv') : t('roster.kicked', 'entfernt')}
                    </StatusChip>
                    {p.status === 'active' && (
                      <Button tone="danger" variant="outline" size="compact" onClick={() => void handleKick(p.player_id)}>
                        {t('roster.remove', 'Entfernen')}
                      </Button>
                    )}
                  </div>
                  {groups.length > 0 && (
                    <div className="u-row u-gap-2">
                      {groups.map((g) => {
                        const isMember = (memberGroups[p.player_id] ?? []).includes(g.id);
                        return (
                          <Button
                            key={g.id}
                            size="compact"
                            tone={isMember ? 'accent' : 'neutral'}
                            variant={isMember ? undefined : 'outline'}
                            onClick={() => void toggleMemberGroup(p.player_id, g.id)}
                          >
                            {g.name}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </li>
              ))}
            </ListSurface>
          </div>
        </>
      )}

      {error !== null && <StatusChip tone="failure" role="alert">{error}</StatusChip>}

      {/* #379 Campaign-Log-Aggregation — reine UI-Aggregation über session_log. */}
      {selectedCampaignId !== '' && (
        <CampaignLog database={database} campaignId={selectedCampaignId} />
      )}
    </Panel>
  );
}

export default CampaignRosterPanel;
