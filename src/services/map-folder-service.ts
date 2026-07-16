// M15-S05: Map-Ordnerbaum — verschachtelte Folders für Maps (#277)
// Organizes maps themselves (map_folders + maps.folder_id) — a separate
// concept from the existing per-map pin folder tree (map_markers.group_name
// with "/"). Independent of M15-S01's layer stack.
import type { DatabaseLike } from './entity-service';

export interface MapFolderRow {
  id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
}

export interface CreateFolderParams {
  name: string;
  parent_id?: string | null;
}

/** Creates a folder. Id is collision-safe: crypto.randomUUID() with a mapfolder_ prefix. */
export async function createFolder(_db: DatabaseLike, _params: CreateFolderParams): Promise<{ id: string }> {
  throw new Error('not implemented');
}

/** Lists all folders (flat — callers build the tree from parent_id). */
export async function listFolders(_db: DatabaseLike): Promise<MapFolderRow[]> {
  throw new Error('not implemented');
}

/** Renames a folder. */
export async function renameFolder(_db: DatabaseLike, _id: string, _name: string): Promise<void> {
  throw new Error('not implemented');
}

/** Deletes a folder. Maps in it fall back to folder_id = NULL (ungrouped) — never cascade-deletes maps. */
export async function deleteFolder(_db: DatabaseLike, _id: string): Promise<void> {
  throw new Error('not implemented');
}

/** Moves a map into a folder (or ungroups it with folderId = null). */
export async function moveMap(_db: DatabaseLike, _mapId: string, _folderId: string | null): Promise<void> {
  throw new Error('not implemented');
}

/**
 * Reparents a folder under newParentId (or to root with null). Rejects
 * (throws) a drop onto itself or onto one of its own descendants — a folder
 * can never become its own ancestor.
 */
export async function moveFolder(_db: DatabaseLike, _folderId: string, _newParentId: string | null): Promise<void> {
  throw new Error('not implemented');
}
