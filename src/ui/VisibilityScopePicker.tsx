// M10-S07 (#356): visibility editor UI — additive per-player/group overrides
// on top of the 4 existing base scopes (Decisions 5–7).
// The base scope lives as a column on the entity (visibility='public'|'gm_only'|
// 'player_known'|'hidden_until_condition'), overrides in
// session_visibility_overrides (S20/S07 schema).
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { listCampaigns, type Campaign } from '../services/campaign-service';
import { listCampaignPlayers, type SessionPlayer } from '../services/player-membership-service';
import { listGroups, type PlayerGroup } from '../services/player-groups-service';
import {
  clearVisibilityOverride, setVisibilityOverride,
} from '../services/visibility-service';
import { Button, StatusChip } from './primitives';

interface PlayerNameRow { id: string; display_name: string }

export type BaseScope = 'public' | 'gm_only' | 'player_known' | 'hidden_until_condition';

export interface VisibilityScopePickerProps {
  database: DatabaseLike;
  targetType: string;
  targetId: string;
  baseScope: BaseScope;
  onBaseScopeChange: (scope: BaseScope) => void;
  /** If undefined → first campaign from the DB automatically, otherwise pin this one. */
  campaignId?: string;
}

interface OverrideRow {
  id: string;
  campaign_id: string;
  target_type: string;
  target_id: string;
  scope: string;
  player_id: string | null;
  group_id: string | null;
}

export function VisibilityScopePicker({
  database, targetType, targetId, baseScope, onBaseScopeChange, campaignId: fixedCampaignId,
}: VisibilityScopePickerProps) {
  const { t } = useTranslation('multiplayer');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(fixedCampaignId ?? '');
  const [players, setPlayers] = useState<SessionPlayer[]>([]);
  const [groups, setGroups] = useState<PlayerGroup[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCampaigns(database).then((cs) => {
      setCampaigns(cs);
      if (fixedCampaignId === undefined && selectedCampaignId === '' && cs.length > 0) {
        setSelectedCampaignId(cs[0].id);
      }
    }).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [database, fixedCampaignId]);

  async function reload() {
    if (selectedCampaignId === '') { setPlayers([]); setGroups([]); setOverrides([]); return; }
    try {
      const [ps, gs, ovs] = await Promise.all([
        listCampaignPlayers(database, selectedCampaignId),
        listGroups({ database, campaignId: selectedCampaignId }),
        database.select<OverrideRow>(
          'SELECT id, campaign_id, target_type, target_id, scope, player_id, group_id FROM session_visibility_overrides WHERE campaign_id = ? AND target_type = ? AND target_id = ?',
          [selectedCampaignId, targetType, targetId],
        ),
      ]);
      const activePlayers = ps.filter((p) => p.status === 'active');
      setPlayers(activePlayers);
      setGroups(gs);
      setOverrides(ovs);
      // Display name instead of UUID: load display_name per player_id.
      if (activePlayers.length > 0) {
        const ids = activePlayers.map((p) => p.player_id);
        const placeholders = ids.map(() => '?').join(',');
        const names = await database.select<PlayerNameRow>(
          `SELECT id, display_name FROM players WHERE id IN (${placeholders})`,
          ids,
        );
        const map: Record<string, string> = {};
        for (const n of names) map[n.id] = n.display_name;
        setPlayerNames(map);
      } else {
        setPlayerNames({});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  useEffect(() => { void reload(); }, [database, selectedCampaignId, targetType, targetId]);

  const playerOverrides = new Set(overrides.filter((o) => o.player_id !== null).map((o) => o.player_id));
  const groupOverrides = new Set(overrides.filter((o) => o.group_id !== null).map((o) => o.group_id));

  async function toggle(kind: 'player' | 'group', id: string) {
    setError(null);
    try {
      const isSet = kind === 'player' ? playerOverrides.has(id) : groupOverrides.has(id);
      if (isSet) {
        await clearVisibilityOverride(database, {
          campaignId: selectedCampaignId,
          targetType, targetId,
          playerId: kind === 'player' ? id : undefined,
          groupId: kind === 'group' ? id : undefined,
        });
      } else {
        await setVisibilityOverride(database, {
          campaignId: selectedCampaignId,
          targetType, targetId,
          scope: kind,
          playerId: kind === 'player' ? id : undefined,
          groupId: kind === 'group' ? id : undefined,
        });
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="visibility-scope-picker u-stack u-gap-2">
      <label className="u-row u-gap-2">
        <span>{t('vis.baseScope', 'Sichtbarkeit')}:</span>
        <select
          aria-label={t('vis.baseScope', 'Sichtbarkeit')}
          value={baseScope}
          onChange={(e) => onBaseScopeChange(e.target.value as BaseScope)}
        >
          <option value="public">{t('vis.public', 'Öffentlich')}</option>
          <option value="gm_only">{t('vis.gmOnly', 'Nur SL')}</option>
          <option value="player_known">{t('vis.playerKnown', 'Nur Bekannte')}</option>
          <option value="hidden_until_condition">{t('vis.conditional', 'Bedingt')}</option>
        </select>
      </label>

      {fixedCampaignId === undefined && campaigns.length > 1 && (
        <label className="u-row u-gap-2">
          <span>{t('vis.campaign', 'Campaign')}:</span>
          <select
            aria-label={t('vis.campaign', 'Campaign')}
            value={selectedCampaignId}
            onChange={(e) => setSelectedCampaignId(e.target.value)}
          >
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
      )}

      {selectedCampaignId !== '' && (
        <>
          <div className="u-stack u-gap-1">
            <span className="u-muted">{t('vis.playersHeader', 'Freigabe an Spieler')}</span>
            {players.length === 0 && (
              <span className="u-muted">{t('vis.noPlayers', 'Keine aktiven Spieler.')}</span>
            )}
            <div className="u-row u-gap-2">
              {players.map((p) => {
                const isSet = playerOverrides.has(p.player_id);
                return (
                  <Button
                    key={p.player_id}
                    size="compact"
                    tone={isSet ? 'accent' : 'neutral'}
                    variant={isSet ? undefined : 'outline'}
                    onClick={() => void toggle('player', p.player_id)}
                  >
                    {playerNames[p.player_id] ?? p.player_id}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="u-stack u-gap-1">
            <span className="u-muted">{t('vis.groupsHeader', 'Freigabe an Gruppen')}</span>
            {groups.length === 0 && (
              <span className="u-muted">{t('vis.noGroups', 'Keine Gruppen.')}</span>
            )}
            <div className="u-row u-gap-2">
              {groups.map((g) => {
                const isSet = groupOverrides.has(g.id);
                return (
                  <Button
                    key={g.id}
                    size="compact"
                    tone={isSet ? 'accent' : 'neutral'}
                    variant={isSet ? undefined : 'outline'}
                    onClick={() => void toggle('group', g.id)}
                  >
                    {g.name}
                  </Button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {error !== null && <StatusChip tone="failure" role="alert">{error}</StatusChip>}
    </div>
  );
}

export default VisibilityScopePicker;
