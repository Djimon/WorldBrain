// M10-#386: aktive „präsentierte Karte" des Play-Cockpits. Der DM wählt im
// Play-Modus bewusst eine Karte, die die Spieler sehen — campaign-scoped +
// persistiert, bewusst getrennt vom Edit-Modus-`selectedMapId`. Die ID (+ die
// Tokens) werden vom Host über den Transport an die Spieler gepusht.
import type { DatabaseLike } from './entity-service';

/**
 * Liest die aktuell präsentierte Karten-ID einer Campaign (oder null).
 */
export async function getPresentedMapId(db: DatabaseLike, campaignId: string): Promise<string | null> {
  const rows = await db.select<{ active_map_id: string | null }>(
    'SELECT active_map_id FROM campaigns WHERE id = ?',
    [campaignId],
  );
  return rows[0]?.active_map_id ?? null;
}

/**
 * Setzt die präsentierte Karte (persistiert, überlebt Reload/Menüwechsel).
 * `null` = keine Karte präsentiert.
 */
export async function setPresentedMapId(
  db: DatabaseLike,
  params: { campaignId: string; mapId: string | null },
): Promise<void> {
  await db.execute(
    'UPDATE campaigns SET active_map_id = ? WHERE id = ?',
    [params.mapId, params.campaignId],
  );
}
