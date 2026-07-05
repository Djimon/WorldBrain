// M10-S04: Spieler-Gruppen — Schema & Services (EPIC-016)
// Groups are scoped to a session (player_groups.session_id); membership is a
// many-to-many join (player_group_members) — a player may belong to multiple
// groups within the same session.
import type { DatabaseLike } from './entity-service';

export interface PlayerGroup {
  id: string;
  session_id: string;
  name: string;
}

export async function createGroup(params: { database: DatabaseLike; sessionId: string; name: string }): Promise<PlayerGroup> {
  const id = `group_${crypto.randomUUID()}`;
  const created_at = new Date().toISOString();
  await params.database.execute(
    'INSERT INTO player_groups (id, session_id, name, created_at) VALUES (?, ?, ?, ?)',
    [id, params.sessionId, params.name, created_at],
  );
  return { id, session_id: params.sessionId, name: params.name };
}

export async function renameGroup(params: { database: DatabaseLike; groupId: string; name: string }): Promise<void> {
  await params.database.execute('UPDATE player_groups SET name = ? WHERE id = ?', [params.name, params.groupId]);
}

export async function deleteGroup(params: { database: DatabaseLike; groupId: string }): Promise<void> {
  await params.database.execute('DELETE FROM player_group_members WHERE group_id = ?', [params.groupId]);
  await params.database.execute('DELETE FROM player_groups WHERE id = ?', [params.groupId]);
}

export async function addMember(params: { database: DatabaseLike; groupId: string; playerId: string }): Promise<void> {
  await params.database.execute(
    'INSERT INTO player_group_members (group_id, player_id) VALUES (?, ?)',
    [params.groupId, params.playerId],
  );
}

export async function removeMember(params: { database: DatabaseLike; groupId: string; playerId: string }): Promise<void> {
  await params.database.execute(
    'DELETE FROM player_group_members WHERE group_id = ? AND player_id = ?',
    [params.groupId, params.playerId],
  );
}

export async function listGroups(params: { database: DatabaseLike; sessionId: string }): Promise<PlayerGroup[]> {
  return params.database.select<PlayerGroup>(
    'SELECT id, session_id, name FROM player_groups WHERE session_id = ?',
    [params.sessionId],
  );
}
