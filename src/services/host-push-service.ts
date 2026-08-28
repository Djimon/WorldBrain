// M10 R2 (#373): Host-Push — filtert pro Empfänger und pusht nur Freigegebenes.
// Nutzt das S07/S09-Backend (visibility-service, player-content-filter-service)
// und die R1-Typen aus play-sync-protocol. Der Transport (S01) bekommt die
// serialisierten Nachrichten zum Verteilen.
import type { Snapshot, SyncEntity, SyncEntityKind } from './play-sync-protocol';

/**
 * Minimales Meta-Objekt einer Host-Sicht: id + base-visibility ('all'|'gm_only'|
 * o.ä.). Die volle S07-Auswertung (per-Player/Group-Overrides) läuft im
 * Callsite über resolveSessionVisibility; dieser Filter ist die letzte Zeile,
 * die verhindert, dass etwas gm_only den Host verlässt.
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
 * Berechnet den initialen Snapshot für EINEN Empfänger. Nicht sichtbare
 * Items (gm_only) fallen hier heraus — sie verlassen den Host nie.
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
 * Filtert eine Menge aktiver Empfänger auf die, die eine Änderung an
 * `item` sehen dürfen. Der eigentliche Overrides-Check liegt im aufrufenden
 * Callsite (S07 resolveSessionVisibility); hier ist der Endgültige gm_only-
 * Cut-Off, damit host-seitige Bugs kein „gm_only rausrutscht" mehr auslösen.
 */
export function computeDeltaRecipients(
  item: HostViewItem,
  recipients: readonly { playerId: string; groupIds: readonly string[] }[],
): string[] {
  if (item.visibility === 'gm_only') return [];
  return recipients.map((r) => r.playerId);
}
