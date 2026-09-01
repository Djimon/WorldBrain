// M10 R2 (#373): host push — filters per recipient and pushes only what is released.
// Uses the S07/S09 backend (visibility-service, player-content-filter-service)
// and the R1 types from play-sync-protocol. The transport (S01) receives the
// serialized messages to distribute.
import type { Snapshot, SyncEntity, SyncEntityKind } from './play-sync-protocol';

/**
 * Minimal meta object of a host view: id + base visibility ('all'|'gm_only'|
 * etc.). The full S07 evaluation (per-player/group overrides) runs at the
 * call site via resolveSessionVisibility; this filter is the last line
 * that prevents anything gm_only from leaving the host.
 */
export interface HostViewItem {
  id: string;
  visibility: string;
  kind?: SyncEntityKind;
  data?: Record<string, unknown>;
}

export interface SnapshotParams {
  entities: readonly HostViewItem[];
  playerId: string;
  groupIds: readonly string[];
  campaignId?: string;
  serverTime?: string;
}

/**
 * Computes the initial snapshot for ONE recipient. Non-visible
 * items (gm_only) are dropped here — they never leave the host.
 */
export async function computeSnapshot(params: SnapshotParams): Promise<Snapshot> {
  const now = params.serverTime ?? new Date().toISOString();
  const visible: SyncEntity[] = [];
  for (const it of params.entities) {
    if (it.visibility === 'gm_only') continue;
    visible.push({
      kind: it.kind ?? 'entity',
      id: it.id,
      data: it.data ?? {},
    });
  }
  return {
    type: 'snapshot',
    campaignId: params.campaignId ?? '',
    recipientPlayerId: params.playerId,
    serverTime: now,
    entities: visible,
  };
}

/**
 * Filters a set of active recipients down to those allowed to see a change to
 * `item`. The actual overrides check lives at the calling
 * call site (S07 resolveSessionVisibility); here is the final gm_only
 * cut-off, so that host-side bugs no longer trigger a "gm_only slips out".
 */
export function computeDeltaRecipients(
  item: HostViewItem,
  recipients: readonly { playerId: string; groupIds: readonly string[] }[],
): string[] {
  if (item.visibility === 'gm_only') return [];
  return recipients.map((r) => r.playerId);
}
