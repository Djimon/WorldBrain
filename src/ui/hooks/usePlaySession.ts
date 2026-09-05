// M10-#432 (refactor): the play-session orchestration extracted from WorkspaceShell.
// This owns the ~play-only concerns — session role / active campaign, the DM host
// transport + sync attaches, the DB-less player store + roster feed, and the
// enter/leave/switch actions — behind a slim interface. `mode`/`setMode` + the mode
// toggle stay in the shell (they steer chrome + the shared area set); this hook only
// supplies the SESSION part (enterPlay/exitPlay/…) and the state the shared views read.
//
// Pure refactor: behaviour is identical to the pre-#432 inline shell code.
import { useEffect, useState, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppMode, SessionRole } from '../AppModeContext';
import type { Area } from '../WorkspaceShell';
import type { DatabaseLike } from '../../services/entity-service';
import { WebRtcTransport } from '../../services/webrtc-transport';
import { currentAppId } from '../../services/app-id-service';
import { attachVisibilityBroadcaster } from '../../services/player-content-filter-service';
import { attachHostJoinSync } from '../../services/host-join-sync';
import { attachClientStoreToTransport } from '../../services/client-store-transport-bridge';
import { broadcastRoster } from '../../services/host-presence-sync';
import { attachHostCombatSync, replayCombatLog } from '../../services/host-combat-log-sync';
import { ROSTER, decodeRoster, type RosterEntry, type TransportMessage } from '../../services/session-transport';
import { createPlayClientStore, type PlayClientStoreImpl } from '../../services/play-client-store';
import { listCampaigns, createCampaign, type Campaign } from '../../services/campaign-service';
import { setPlayContext, clearPlayContext } from '../../services/play-context-store';

export interface PlayerContext { playerId: string; displayName: string }

export interface UsePlaySessionParams {
  database: DatabaseLike;
  projectId: string;
  /** Owned by the shell (steers chrome + shared area set); read here for the host effect + join gate. */
  mode: AppMode;
  setMode: (m: AppMode) => void;
  setActiveArea: (a: Area) => void;
  lastAreaByMode: MutableRefObject<{ edit: Area; play: Area }>;
}

export interface UsePlaySession {
  // --- session state (read by the shared views / play surface) ---
  sessionRole: SessionRole;
  activeSessionId: string | null;
  showRoleSelect: boolean;
  playerContext: PlayerContext | null;
  playerStore: PlayClientStoreImpl | null;
  hostTransport: WebRtcTransport | null;
  playerTransport: WebRtcTransport | null;
  sessionLive: boolean;
  playerRoster: RosterEntry[];
  playerSessionLive: boolean;
  combatLogTick: number;
  availableCampaigns: Campaign[];
  selectedCampaignForPlay: string;
  newCampaignTitle: string;
  playerNeedsJoin: boolean;
  // --- setters used by the role-select panel + the join flow ---
  setSelectedCampaignForPlay: (id: string) => void;
  setNewCampaignTitle: (t: string) => void;
  setShowRoleSelect: (v: boolean) => void;
  setPlayerContext: (c: PlayerContext | null) => void;
  setPlayerTransport: (t: WebRtcTransport | null) => void;
  setPlayerGroupIds: (ids: string[]) => void;
  // --- actions ---
  enterPlay: (campaignId: string, role: 'dm' | 'player') => Promise<void>;
  openRoleSelect: () => void;
  /** Reset the session state WITHOUT touching mode/area (the mode toggle owns those). */
  exitPlay: () => void;
  pickRole: (role: 'dm' | 'player') => Promise<void>;
  createAndPickCampaign: () => Promise<void>;
  startSession: () => void;
  stopSession: () => Promise<void>;
  rebroadcastRoster: () => void;
  switchPlayCampaign: (campaignId: string) => void;
  switchPlayRole: (role: 'dm' | 'player') => void;
  leavePlaySession: () => void;
  /** PlayerJoinView onJoined handler — sets the player context/transport + loads groups. */
  handlePlayerJoined: (result: { token: string; playerId: string; displayName: string; transport?: WebRtcTransport }) => Promise<void>;
}

export function usePlaySession(params: UsePlaySessionParams): UsePlaySession {
  const { database, projectId, mode, setMode, setActiveArea, lastAreaByMode } = params;
  const { t } = useTranslation('nav');

  const [sessionRole, setSessionRole] = useState<SessionRole>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showRoleSelect, setShowRoleSelect] = useState(false);
  const [playerContext, setPlayerContext] = useState<PlayerContext | null>(null);
  const [, setPlayerGroupIds] = useState<string[]>([]);
  const [playerStore, setPlayerStore] = useState<PlayClientStoreImpl | null>(null);
  const [hostTransport, setHostTransport] = useState<WebRtcTransport | null>(null);
  const [playerTransport, setPlayerTransport] = useState<WebRtcTransport | null>(null);
  const [sessionLive, setSessionLive] = useState(false);
  const [playerRoster, setPlayerRoster] = useState<RosterEntry[]>([]);
  const [playerSessionLive, setPlayerSessionLive] = useState(false);
  const [combatLogTick, setCombatLogTick] = useState(0);
  const [availableCampaigns, setAvailableCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignForPlay, setSelectedCampaignForPlay] = useState<string>('');
  const [newCampaignTitle, setNewCampaignTitle] = useState('');

  // #390: open the "campaign + role" selection step (only when no context).
  function openRoleSelect() {
    setShowRoleSelect(true);
    void listCampaigns(database).then((cs) => {
      setAvailableCampaigns(cs);
      if (cs.length === 1) setSelectedCampaignForPlay(cs[0].id);
    });
  }

  // #390: enter the remembered context directly. Edge case: if the campaign no longer
  // exists (deleted) → discard the context and fall back cleanly to the selection step.
  async function enterPlay(campaignId: string, role: 'dm' | 'player') {
    const cs = await listCampaigns(database);
    setAvailableCampaigns(cs);
    if (!cs.some((c) => c.id === campaignId)) {
      clearPlayContext(projectId);
      if (cs.length === 1) setSelectedCampaignForPlay(cs[0].id);
      setShowRoleSelect(true);
      return;
    }
    setMode('play');
    setSessionRole(role);
    setActiveSessionId(campaignId);
    setSelectedCampaignForPlay(campaignId);
    setShowRoleSelect(false);
    setActiveArea(lastAreaByMode.current.play); // restore the last play view (default: lobby)
  }

  // Reset session state on the play→edit mode toggle (context stays — fast way back).
  function exitPlay() {
    setSessionRole(null);
    setActiveSessionId(null);
    setShowRoleSelect(false);
  }

  async function pickRole(role: 'dm' | 'player') {
    let campaignId = selectedCampaignForPlay;
    if (campaignId === '') {
      // No campaign selected: the DM may auto-create one (prevents a dead end in an
      // empty project); the player needs a selection.
      if (role === 'dm') {
        const c = await createCampaign(database, { title: t('modeCampaignDefault', 'Default Campaign') });
        campaignId = c.id;
        setAvailableCampaigns((prev) => [...prev, c]);
      } else {
        return;
      }
    }
    setMode('play');
    setSessionRole(role);
    setActiveSessionId(campaignId);
    setSelectedCampaignForPlay(campaignId);
    setShowRoleSelect(false);
    setActiveArea(lastAreaByMode.current.play); // restore the last play view (default: lobby)
    setPlayContext(projectId, { campaignId, role }); // #390: remember context
  }

  // #421 — DM session control (Start/Stop = the connection). Start arms the host transport
  // effect (opens signaling + broadcasts the roster); Stop tears it down (effect cleanup
  // closes the transport → all players disconnected).
  function startSession() { setSessionLive(true); }
  async function stopSession() {
    // #421 Low 1: AWAIT the "session down" broadcast BEFORE flipping sessionLive — the flip
    // triggers the effect cleanup that closes the transport, so a fire-and-forget send would
    // race the close and the players' `session: läuft` chip would stay stale.
    if (hostTransport !== null && activeSessionId !== null) {
      await broadcastRoster({ transport: hostTransport, database, campaignId: activeSessionId, live: false })
        .catch(() => { /* offline / send failed — the close below disconnects them anyway */ });
    }
    setSessionLive(false);
  }
  /** #421 Low 2: clear the player's presence feed so a stale roster/status can't flash on
   *  the next entry (before the first fresh `roster` broadcast arrives). */
  function resetPlayerPresence() {
    setPlayerRoster([]);
    setPlayerSessionLive(false);
  }
  /** Re-broadcast the roster after a host-side change (kick) while the session is live. */
  function rebroadcastRoster() {
    if (hostTransport === null || activeSessionId === null || !sessionLive) return;
    void broadcastRoster({ transport: hostTransport, database, campaignId: activeSessionId, live: true });
  }

  // #390 — play-settings actions (in play mode, its own area):
  /** Switch campaign without the edit detour — updates the active session + remembered context. */
  function switchPlayCampaign(campaignId: string) {
    if (campaignId === activeSessionId) return;
    setSessionLive(false); // #421: a different campaign is a different room — DM re-starts.
    resetPlayerPresence();
    setActiveSessionId(campaignId);
    setSelectedCampaignForPlay(campaignId);
    if (sessionRole === 'dm' || sessionRole === 'player') {
      setPlayContext(projectId, { campaignId, role: sessionRole });
    }
  }
  /** Switch role (DM/Player) — switching to player resets the join context. */
  function switchPlayRole(role: 'dm' | 'player') {
    if (role === sessionRole) return;
    setSessionLive(false); // #421: role switch resets the session — DM must re-Start.
    resetPlayerPresence();
    setSessionRole(role);
    if (role === 'player') setPlayerContext(null);
    if (activeSessionId !== null) setPlayContext(projectId, { campaignId: activeSessionId, role });
  }
  /** Leave the session — clear the remembered context and back to edit. */
  function leavePlaySession() {
    clearPlayContext(projectId);
    setSessionLive(false); // #421: leaving closes the connection.
    resetPlayerPresence();
    setMode('edit');
    setSessionRole(null);
    setActiveSessionId(null);
    setShowRoleSelect(false);
    lastAreaByMode.current.play = 'lobby'; // deliberate exit → next play starts at the lobby view
    setActiveArea(lastAreaByMode.current.edit);
  }
  async function createAndPickCampaign() {
    if (newCampaignTitle.trim() === '') return;
    const c = await createCampaign(database, { title: newCampaignTitle.trim() });
    setAvailableCampaigns((prev) => [...prev, c]);
    setSelectedCampaignForPlay(c.id);
    setNewCampaignTitle('');
  }

  // #420 (S1) / #387: an un-joined player starts with the DB-less join handshake — no
  // `database` prop (join runs as a transport handshake). Once ok:true, the connected
  // transport is threaded (#386 D29-Feed) + the player's group membership loaded (filter
  // context for S09, consumed once #427/S8 wires the store data source).
  async function handlePlayerJoined(
    { playerId, displayName, transport }: { token: string; playerId: string; displayName: string; transport?: WebRtcTransport },
  ): Promise<void> {
    setPlayerContext({ playerId, displayName });
    setPlayerTransport(transport ?? null);
    try {
      const rows = await database.select<{ group_id: string }>(
        'SELECT group_id FROM group_members WHERE player_id = ?',
        [playerId],
      );
      setPlayerGroupIds(rows.map((r) => r.group_id));
    } catch { /* no group_members → empty list */ }
  }

  // #420 (S1): a player must join before any player-side view is shown — until
  // playerContext is set, PlayerJoinView is the play surface.
  const playerNeedsJoin = mode === 'play' && sessionRole === 'player' && playerContext === null && activeSessionId !== null;

  // #374 D30: create the player store once the player context is fixed (an empty store =
  // "host offline"). Snapshot+delta is fed by the client transport.
  useEffect(() => {
    if (sessionRole !== 'player' || playerContext === null) { setPlayerStore(null); return; }
    setPlayerStore(createPlayClientStore({ playerId: playerContext.playerId }));
  }, [sessionRole, playerContext]);

  // M10-#386 (D29 feed): once both the player store AND transport exist, attach the store
  // to the transport feed — snapshot/delta (incl. token movements) then flow into the
  // DB-less client.
  useEffect(() => {
    if (playerStore === null || playerTransport === null) return;
    const dispose = attachClientStoreToTransport(playerTransport, playerStore);
    return () => dispose();
  }, [playerStore, playerTransport]);

  // #373 M10-R2 + S11: wire up host push + attach broker signaling. In the host/connect
  // model the DM is peer 'A' (initiator). appId = currentAppId (per-host namespace);
  // roomId = campaignId. The signaling adapter runs the fallback chain and brokers
  // SDP/ICE — game data stays P2P.
  useEffect(() => {
    // #421: gated on sessionLive — the connection opens only when the DM presses Start.
    if (mode !== 'play' || sessionRole !== 'dm' || activeSessionId === null || !sessionLive) return;
    const transport = WebRtcTransport.host(activeSessionId, database);
    setHostTransport(transport);
    const campaignId = activeSessionId;
    void (async () => {
      await transport.connect();
      const appId = await currentAppId();
      await transport.attachSignaling({
        appId,
        roomId: campaignId,
        peerLabel: 'A',
        onError: (err) => console.warn('[host-signaling]', err.message),
      });
    })().catch((e) => console.warn('[host-signaling] setup failed', e));
    const unsub = attachVisibilityBroadcaster(transport);
    // #412: token movement + presented-map snapshot are MAP-feature glue. Gate them behind
    // feature('maps') via dynamic import so the map read-path tree-shakes out at maps=false.
    const mapsOn = import.meta.env.DEV || __FEATURE_MAPS__;
    // M10-#386 (D18, host-authoritative): authorize incoming token movement intents from
    // players + persist ground truth + broadcast. Map-only → maps-gated lazy.
    if (mapsOn) {
      void import('../../services/host-token-sync').then(({ attachHostTokenSync }) => {
        attachHostTokenSync({ transport, database, campaignId });
      });
    }
    // #422 (S3, D17): authorize incoming roll_dice intents + persist + broadcast public
    // ('all') entries. ALWAYS wired — the combat LOG + dice are foundational; the future
    // `combat` FEATURE is the real VTT rule-engine, unrelated to this log.
    attachHostCombatSync({ transport, database, campaignId, onPersisted: () => setCombatLogTick((n) => n + 1) });
    // M10-#387 (D24/D29): DB-less join/reconnect handshake — SESSION-CORE, always wired
    // (map-free). The initial-scene push (presented map + tokens, #386) is the maps
    // contribution, injected as onAfterJoin only when maps is on.
    attachHostJoinSync({
      transport,
      database,
      campaignId,
      onAfterJoin: async (playerId) => {
        if (mapsOn) {
          const { pushPresentedMapSnapshot } = await import('../../services/presented-map-push');
          await pushPresentedMapSnapshot({ database, campaignId, transport, recipientPlayerId: playerId });
        }
        await broadcastRoster({ transport, database, campaignId, live: true });
        // #422: replay the public combat log AFTER the snapshot — the joining player gets
        // the history, and it survives the snapshot's store reset (applySnapshot clears).
        await replayCombatLog({ transport, database, campaignId });
      },
    });
    // M10-#386: initial snapshot of the presented map once the host transport is up, so
    // already-connected players get the scene. Maps-gated (present() re-pushes on change).
    if (mapsOn) {
      void import('../../services/presented-map-push').then(({ pushPresentedMapSnapshot }) => {
        void pushPresentedMapSnapshot({ database, campaignId, transport });
      });
    }
    // #421: initial roster broadcast on session start, so already-connected players see the
    // live session + current roster immediately.
    void broadcastRoster({ transport, database, campaignId, live: true });
    return () => {
      unsub();
      setHostTransport(null);
      void transport.close().catch(() => {});
    };
  }, [mode, sessionRole, activeSessionId, database, sessionLive]);

  // #421: player-side roster feed — subscribe to the host `roster` broadcast on the player
  // transport. This is the DB-less player's only source for the connected-players list +
  // the session-live flag (deliberately NOT the reset-on-snapshot client store).
  useEffect(() => {
    if (playerTransport === null) return;
    const dispose = playerTransport.onMessage((msg: TransportMessage) => {
      if (msg.type !== ROSTER) return;
      const p = decodeRoster(msg.payload); // typed + validated in ONE place (no cast here)
      if (p === null) return;
      setPlayerRoster(p.players);
      setPlayerSessionLive(p.live);
    });
    return () => { dispose(); };
  }, [playerTransport]);

  return {
    sessionRole, activeSessionId, showRoleSelect, playerContext, playerStore,
    hostTransport, playerTransport, sessionLive, playerRoster, playerSessionLive,
    combatLogTick, availableCampaigns, selectedCampaignForPlay, newCampaignTitle,
    playerNeedsJoin,
    setSelectedCampaignForPlay, setNewCampaignTitle, setShowRoleSelect,
    setPlayerContext, setPlayerTransport, setPlayerGroupIds,
    enterPlay, openRoleSelect, exitPlay, pickRole, createAndPickCampaign,
    startSession, stopSession, rebroadcastRoster,
    switchPlayCampaign, switchPlayRole, leavePlaySession, handlePlayerJoined,
  };
}
