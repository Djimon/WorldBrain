import type { DatabaseLike } from './entity-service';

export interface PlayerCharacter {
  entityId: string;
  playerId: string;
  sessionId: string;
  name: string;
}

export async function createPlayerCharacter(
  db: DatabaseLike,
  params: { sessionId: string; playerId: string; name: string; systemPluginId?: string | null },
): Promise<PlayerCharacter> {
  const existing = await db.select<{ id: string }>(
    `SELECT id FROM base_entities WHERE player_id = ? AND session_id = ? AND is_player_character = 1`,
    [params.playerId, params.sessionId],
  );
  if (existing.length > 0) throw new Error('Player already has a character in this session (D10)');

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO base_entities
      (id, type, title, summary, aliases_json, properties_json, body_json, visibility,
       created_at, updated_at, is_player_character, player_id, session_id)
     VALUES (?, 'Character', ?, '', '[]', '{}', '{}', 'private', ?, ?, 1, ?, ?)`,
    [id, params.name, now, now, params.playerId, params.sessionId],
  );
  return { entityId: id, playerId: params.playerId, sessionId: params.sessionId, name: params.name };
}

export async function getPlayerCharacter(
  db: DatabaseLike,
  params: { sessionId: string; playerId: string },
): Promise<PlayerCharacter | null> {
  const rows = await db.select<{ id: string; title: string }>(
    `SELECT id, title FROM base_entities WHERE player_id = ? AND session_id = ? AND is_player_character = 1`,
    [params.playerId, params.sessionId],
  );
  if (!rows[0]) return null;
  return { entityId: rows[0].id, playerId: params.playerId, sessionId: params.sessionId, name: rows[0].title };
}

export async function updatePlayerCharacter(
  db: DatabaseLike,
  params: { entityId: string; requestingPlayerId: string; name: string },
): Promise<void> {
  const rows = await db.select<{ player_id: string }>(
    `SELECT player_id FROM base_entities WHERE id = ? AND is_player_character = 1`,
    [params.entityId],
  );
  if (!rows[0] || rows[0].player_id !== params.requestingPlayerId) {
    throw new Error('Not authorized to edit this character (D20)');
  }
  await db.execute(
    `UPDATE base_entities SET title = ?, updated_at = ? WHERE id = ?`,
    [params.name, new Date().toISOString(), params.entityId],
  );
}
