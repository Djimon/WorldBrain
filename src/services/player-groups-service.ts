// M10-S04 (#353): Spieler-Gruppen — campaign-scoped (D23).
// Ein Spieler kann in mehreren Gruppen sein; Gruppen einer Campaign A sind
// in Campaign B unsichtbar. Basis für Visibility-Targeting (S07).
import type { DatabaseLike } from './entity-service';

export interface PlayerGroup {
  id: string;
  campaign_id: string;
  name: string;
  created_at: string;
}

export interface CreateGroupParams {
  database: DatabaseLike;
  campaignId: string;
  name: string;
}

export interface RenameGroupParams {
  database: DatabaseLike;
  groupId: string;
  name: string;
}

export interface DeleteGroupParams {
  database: DatabaseLike;
  groupId: string;
}

export interface MemberParams {
  database: DatabaseLike;
  groupId: string;
  playerId: string;
}

export interface ListGroupsParams {
  database: DatabaseLike;
  campaignId: string;
}

export async function createGroup(params: CreateGroupParams): Promise<PlayerGroup> {
  const id = `group_${crypto.randomUUID()}`;
  const created_at = new Date().toISOString();
  await params.database.execute(
    'INSERT INTO player_groups (id, campaign_id, name, created_at) VALUES (?, ?, ?, ?)',
    [id, params.campaignId, params.name, created_at],
  );
  return { id, campaign_id: params.campaignId, name: params.name, created_at };
}

export async function renameGroup(params: RenameGroupParams): Promise<void> {
  await params.database.execute(
    'UPDATE player_groups SET name = ? WHERE id = ?',
    [params.name, params.groupId],
  );
}

/** Löscht die Gruppe und alle Mitgliedschaften (kein DB-CASCADE, per Hand). */
export async function deleteGroup(params: DeleteGroupParams): Promise<void> {
  await params.database.execute('DELETE FROM group_members WHERE group_id = ?', [params.groupId]);
  await params.database.execute('DELETE FROM player_groups WHERE id = ?', [params.groupId]);
}

export async function addMember(params: MemberParams): Promise<void> {
  await params.database.execute(
    'INSERT OR IGNORE INTO group_members (group_id, player_id) VALUES (?, ?)',
    [params.groupId, params.playerId],
  );
}

export async function removeMember(params: MemberParams): Promise<void> {
  await params.database.execute(
    'DELETE FROM group_members WHERE group_id = ? AND player_id = ?',
    [params.groupId, params.playerId],
  );
}

export async function listGroups(params: ListGroupsParams): Promise<PlayerGroup[]> {
  return params.database.select<PlayerGroup>(
    'SELECT id, campaign_id, name, created_at FROM player_groups WHERE campaign_id = ? ORDER BY created_at',
    [params.campaignId],
  );
}
