// M15-S05: map folder tree — nested folders for maps (#277)
// Organizes maps themselves (map_folders + maps.folder_id) — a separate
// concept from the existing per-map pin folder tree (map_markers.group_name
// with "/"). Independent of M15-S01's layer stack.
import type { DatabaseLike } from './entity-service';

export interface MapFolderRow {
  id: string;
  parent_id: string | null;
  name: string;
  color: string | null;
  created_at: string;
}

export interface CreateFolderParams {
  name: string;
  parent_id?: string | null;
}

/** Creates a folder. Id is collision-safe: crypto.randomUUID() with a mapfolder_ prefix. */
export async function createFolder(db: DatabaseLike, params: CreateFolderParams): Promise<{ id: string }> {
  const id = `mapfolder_${crypto.randomUUID()}`;
  await db.execute(
    'INSERT INTO map_folders (id, parent_id, name) VALUES (?, ?, ?)',
    [id, params.parent_id ?? null, params.name],
  );
  return { id };
}

/** Lists all folders (flat — callers build the tree from parent_id). */
export async function listFolders(db: DatabaseLike): Promise<MapFolderRow[]> {
  return db.select<MapFolderRow>('SELECT * FROM map_folders');
}

/** Renames a folder. */
export async function renameFolder(db: DatabaseLike, id: string, name: string): Promise<void> {
  await db.execute('UPDATE map_folders SET name = ? WHERE id = ?', [name, id]);
}

/** Sets a folder's display color (hex string, e.g. "#a5d6a7"), or null to reset to the default. */
export async function setFolderColor(db: DatabaseLike, id: string, color: string | null): Promise<void> {
  await db.execute('UPDATE map_folders SET color = ? WHERE id = ?', [color, id]);
}

/** Deletes a folder. Maps in it fall back to folder_id = NULL (ungrouped) — never cascade-deletes maps. */
export async function deleteFolder(db: DatabaseLike, id: string): Promise<void> {
  await db.execute('UPDATE maps SET folder_id = NULL WHERE folder_id = ?', [id]);
  await db.execute('DELETE FROM map_folders WHERE id = ?', [id]);
}

/** Moves a map into a folder (or ungroups it with folderId = null). */
export async function moveMap(db: DatabaseLike, mapId: string, folderId: string | null): Promise<void> {
  await db.execute('UPDATE maps SET folder_id = ? WHERE id = ?', [folderId, mapId]);
}

/**
 * Reparents a folder under newParentId (or to root with null). Rejects
 * (throws) a drop onto itself or onto one of its own descendants — a folder
 * can never become its own ancestor.
 */
export async function moveFolder(db: DatabaseLike, folderId: string, newParentId: string | null): Promise<void> {
  if (newParentId === folderId) {
    throw new Error('A folder cannot be reparented onto itself');
  }
  if (newParentId !== null) {
    const folders = await listFolders(db);
    const byId = new Map(folders.map((f) => [f.id, f]));
    let cursor: string | null = newParentId;
    while (cursor !== null) {
      if (cursor === folderId) {
        throw new Error('A folder cannot be reparented onto its own descendant');
      }
      cursor = byId.get(cursor)?.parent_id ?? null;
    }
  }
  await db.execute('UPDATE map_folders SET parent_id = ? WHERE id = ?', [newParentId, folderId]);
}
