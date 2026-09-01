// M10-S06 (#355): GM lobby — live view of connected players + Kick +
// copy-code (D24/D27). Auto-join makes separate approval sections
// obsolete. Signaling UI stays stage 3 (S11/S12) — NOT mounted here.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { listCampaignPlayers, kick as kickPlayer } from '../services/player-membership-service';
import { generateInviteCode, getActiveInviteCode } from '../services/session-identity-service';
import { currentAppId } from '../services/app-id-service';
import type { SessionPlayer } from '../services/player-membership-service';
import { addMember, listGroups, removeMember, type PlayerGroup } from '../services/player-groups-service';
import { Button, Field, ListSurface, Panel, StatusChip } from './primitives';

interface PlayerRow { id: string; display_name: string }
interface GroupMemberRow { group_id: string; player_id: string }

export interface LobbyPanelProps {
  database: DatabaseLike;
  campaignId: string;
  /** Current invite code — initially set / persisted by the host owner. */
  currentInviteCode?: string;
  /** New code after regeneration — callback for the persistence layer. */
  onInviteCodeChanged?: (newCode: string) => void;
}

export function LobbyPanel({ database, campaignId, currentInviteCode = '', onInviteCodeChanged }: LobbyPanelProps) {
  const { t } = useTranslation('multiplayer');
  const [players, setPlayers] = useState<SessionPlayer[]>([]);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [inviteCode, setInviteCode] = useState(currentInviteCode);
  // S11 (#367): the per-host `appId` (from getHostSecret + majorMinor) is
  // encoded as `&ns=<appId>` in the invite link — the joiner cannot derive
  // the broker namespace itself, so the link carries it.
  const [nsAppId, setNsAppId] = useState('');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // #377 D31: campaign-scoped groups (names from the edit panel #371) +
  // per-member assignment; here the members really exist.
  const [groups, setGroups] = useState<PlayerGroup[]>([]);
  const [memberGroups, setMemberGroups] = useState<Record<string, string[]>>({});

  async function reload() {
    try {
      const [rows, gs] = await Promise.all([
        listCampaignPlayers(database, campaignId),
        listGroups({ database, campaignId }),
      ]);
      setPlayers(rows);
      setGroups(gs);
      // Display name instead of UUID: load display_name from the players table.
      if (rows.length > 0) {
        const ids = rows.map((r) => r.player_id);
        const placeholders = ids.map(() => '?').join(',');
        const names = await database.select<PlayerRow>(
          `SELECT id, display_name FROM players WHERE id IN (${placeholders})`,
          ids,
        );
        const map: Record<string, string> = {};
        for (const n of names) map[n.id] = n.display_name;
        setPlayerNames(map);
        // Load group membership per member.
        const memberships = await database.select<GroupMemberRow>(
          `SELECT group_id, player_id FROM group_members WHERE player_id IN (${placeholders})`,
          ids,
        );
        const mg: Record<string, string[]> = {};
        for (const m of memberships) {
          if (!mg[m.player_id]) mg[m.player_id] = [];
          mg[m.player_id].push(m.group_id);
        }
        setMemberGroups(mg);
      } else {
        setPlayerNames({});
        setMemberGroups({});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('lobby.loadError', 'Roster konnte nicht geladen werden.'));
    }
  }

  async function toggleGroup(playerId: string, groupId: string) {
    setError(null);
    const current = memberGroups[playerId] ?? [];
    try {
      if (current.includes(groupId)) await removeMember({ database, groupId, playerId });
      else await addMember({ database, groupId, playerId });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => { void reload(); }, [database, campaignId]);

  // #371 Fix 1/2: load the active code from the DB on mount — no auto-generate,
  // regenerating stays an explicit action.
  useEffect(() => {
    if (campaignId === '') return;
    let cancelled = false;
    void getActiveInviteCode(database, campaignId).then((code) => {
      if (cancelled) return;
      if (code !== null) setInviteCode(code);
    }).catch(() => { /* fail-open */ });
    return () => { cancelled = true; };
  }, [database, campaignId]);

  async function handleKick(playerId: string) {
    setError(null);
    try {
      await kickPlayer(database, { campaignId, playerId });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('lobby.kickError', 'Kick fehlgeschlagen.'));
    }
  }

  async function handleRegenerate() {
    setError(null);
    try {
      const next = await generateInviteCode(database, { campaignId });
      setInviteCode(next);
      onInviteCodeChanged?.(next);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setError(`${t('lobby.regenError', 'Code konnte nicht neu erzeugt werden.')} — ${raw}`);
    }
  }

  // Roster display: active only. Kicked players stay in the DB (token lock for
  // reconnect protection), but no longer appear in "Connected players".
  const activePlayers = players.filter((p) => p.status === 'active');

  // Derive the appId on mount (deterministic, per-host).
  useEffect(() => {
    let cancelled = false;
    void currentAppId().then((id) => { if (!cancelled) setNsAppId(id); });
    return () => { cancelled = true; };
  }, []);

  // Shareable invite link (D27 + S11): carries code + campaign + `ns` as the
  // unguessable broker namespace. S05 accepts a link OR a bare code —
  // the link is the only source for `ns` (no manual entry).
  const inviteLink = inviteCode !== ''
    ? `wbrain://join?code=${encodeURIComponent(inviteCode)}&campaign=${encodeURIComponent(campaignId)}&ns=${encodeURIComponent(nsAppId)}`
    : '';

  async function copyToClipboard(text: string) {
    if (text === '') return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(t('lobby.copied', 'kopiert'));
      window.setTimeout(() => setCopyFeedback(null), 1500);
    } catch {
      setError(t('lobby.copyError', 'Kopieren fehlgeschlagen.'));
    }
  }

  async function handleCopy() {
    await copyToClipboard(inviteCode);
  }
  async function handleCopyLink() {
    await copyToClipboard(inviteLink);
  }

  return (
    <Panel className="lobby-panel u-stack u-gap-3" role="region"
      aria-label={t('lobby.title', 'Lobby')}>
      <h2>{t('lobby.title', 'Lobby')}</h2>

      <div className="lobby-panel__invite u-stack u-gap-2">
        <Field
          label={t('lobby.inviteLabel', 'Einladungscode')}
          value={inviteCode}
          readOnly
          onChange={() => { /* readonly */ }}
        />
        <div className="u-row u-gap-2">
          <Button tone="accent" onClick={() => void handleCopy()} disabled={inviteCode === ''}>
            {t('lobby.copy', 'Code kopieren')}
          </Button>
          <Button onClick={() => void handleRegenerate()}>
            {t('lobby.regenerate', 'Neuen Code erzeugen')}
          </Button>
        </div>
        <Field
          label={t('lobby.inviteLinkLabel', 'Einladungslink')}
          value={inviteLink}
          readOnly
          onChange={() => { /* readonly */ }}
        />
        <div className="u-row u-gap-2">
          <Button onClick={() => void handleCopyLink()} disabled={inviteLink === ''}>
            {t('lobby.copyLink', 'Link kopieren')}
          </Button>
          {copyFeedback !== null && <StatusChip tone="success">{copyFeedback}</StatusChip>}
        </div>
      </div>

      {error !== null && (
        <StatusChip tone="failure" role="alert">{error}</StatusChip>
      )}

      <div className="lobby-panel__roster u-stack u-gap-2">
        <h3>{t('lobby.rosterTitle', 'Verbundene Spieler')}</h3>
        <ListSurface>
          {activePlayers.length === 0 && (
            <li className="lobby-panel__empty">{t('lobby.rosterEmpty', 'Noch niemand beigetreten.')}</li>
          )}
          {activePlayers.map((p) => {
            const assigned = memberGroups[p.player_id] ?? [];
            return (
              <li key={p.id} className="lobby-panel__player u-stack u-gap-1">
                <div className="u-row u-gap-2">
                  <span className="lobby-panel__player-name">{playerNames[p.player_id] ?? p.player_id}</span>
                  <StatusChip tone="success">{t('lobby.online', 'online')}</StatusChip>
                  <Button
                    tone="danger"
                    variant="outline"
                    size="compact"
                    onClick={() => void handleKick(p.player_id)}
                  >
                    {t('lobby.kick', 'Kick')}
                  </Button>
                </div>
                {groups.length > 0 && (
                  <div className="u-row u-gap-2">
                    <span className="u-muted">{t('lobby.groups', 'Gruppen:')}</span>
                    {groups.map((g) => {
                      const isMember = assigned.includes(g.id);
                      return (
                        <Button
                          key={g.id}
                          size="compact"
                          tone={isMember ? 'accent' : 'neutral'}
                          variant={isMember ? undefined : 'outline'}
                          onClick={() => void toggleGroup(p.player_id, g.id)}
                        >
                          {g.name}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ListSurface>
      </div>
    </Panel>
  );
}

export default LobbyPanel;
