// @vitest-environment node
// M15-S05: Map-Ordnerbaum (Service) — map_folders Schema & CRUD
// See: https://github.com/Djimon/WorldBrain/issues/277
//
// Note: pure DatabaseLike service module (no UI in this file) — AP-001 is
// satisfied structurally (every function takes DatabaseLike); not
// separately re-tested to avoid fabricating a non-existent requirement.

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { applyMapSchema } from '../core_data/map-schema';
import type { DatabaseLike } from '../src/services/entity-service';

function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => {
      db.prepare(sql).run(...args);
      return Promise.resolve();
    },
    select: <T>(sql: string, args: unknown[] = []): Promise<T[]> => {
      return Promise.resolve(db.prepare(sql).all(...args) as T[]);
    },
  };
}

function createDatabase() {
  const raw = new DatabaseSync(':memory:');
  applyMapSchema(raw);
  return { db: raw, asyncDb: makeAsyncDb(raw) };
}

async function getMapFolderService() { return import('../src/services/map-folder-service'); }

describe('M15-S05 map folders schema & service', () => {
  describe('table shape', () => {
    it('creates a map_folders table with id, parent_id, name, created_at', () => {
      const { db } = createDatabase();
      try {
        const cols = (db.prepare('PRAGMA table_info(map_folders)').all() as Array<{ name: string }>).map((c) => c.name);
        expect(cols.sort()).toEqual(['color', 'created_at', 'id', 'name', 'parent_id'].sort());
      } finally {
        db.close();
      }
    });

    it('maps table gains a nullable folder_id column', () => {
      const { db } = createDatabase();
      try {
        const cols = (db.prepare('PRAGMA table_info(maps)').all() as Array<{ name: string }>).map((c) => c.name);
        expect(cols).toContain('folder_id');
      } finally {
        db.close();
      }
    });
  });

  describe('createFolder', () => {
    it('creates a root folder with an id prefixed mapfolder_', async () => {
      const { db, asyncDb } = createDatabase();
      const { createFolder } = await getMapFolderService();
      try {
        const { id } = await createFolder(asyncDb, { name: 'Dungeons' });
        expect(id).toMatch(/^mapfolder_/);
      } finally {
        db.close();
      }
    });

    it('creates a nested folder with a parent_id', async () => {
      const { db, asyncDb } = createDatabase();
      const { createFolder, listFolders } = await getMapFolderService();
      try {
        const { id: parentId } = await createFolder(asyncDb, { name: 'Dungeons' });
        await createFolder(asyncDb, { name: 'Level 1', parent_id: parentId });
        const folders = await listFolders(asyncDb);
        expect(folders.find((f) => f.name === 'Level 1')?.parent_id).toBe(parentId);
      } finally {
        db.close();
      }
    });
  });

  describe('renameFolder', () => {
    it('renames the folder', async () => {
      const { db, asyncDb } = createDatabase();
      const { createFolder, renameFolder, listFolders } = await getMapFolderService();
      try {
        const { id } = await createFolder(asyncDb, { name: 'Old Name' });
        await renameFolder(asyncDb, id, 'New Name');
        const folders = await listFolders(asyncDb);
        expect(folders.find((f) => f.id === id)?.name).toBe('New Name');
      } finally {
        db.close();
      }
    });
  });

  describe('deleteFolder: maps fall back to ungrouped, never cascade-deleted', () => {
    it('a map in the deleted folder becomes folder_id = NULL, still exists', async () => {
      const { db, asyncDb } = createDatabase();
      const { createFolder, deleteFolder, moveMap } = await getMapFolderService();
      try {
        db.prepare(`INSERT INTO maps (id, title) VALUES (?, ?)`).run('map-1', 'Test Map');
        const { id: folderId } = await createFolder(asyncDb, { name: 'Temp' });
        await moveMap(asyncDb, 'map-1', folderId);
        await deleteFolder(asyncDb, folderId);
        const row = db.prepare('SELECT folder_id FROM maps WHERE id = ?').get('map-1') as { folder_id: string | null };
        expect(row.folder_id).toBeNull();
        const stillExists = db.prepare('SELECT id FROM maps WHERE id = ?').get('map-1');
        expect(stillExists).toBeTruthy();
      } finally {
        db.close();
      }
    });

    it('deleting a folder removes it from listFolders', async () => {
      const { db, asyncDb } = createDatabase();
      const { createFolder, deleteFolder, listFolders } = await getMapFolderService();
      try {
        const { id } = await createFolder(asyncDb, { name: 'Temp' });
        await deleteFolder(asyncDb, id);
        expect((await listFolders(asyncDb)).find((f) => f.id === id)).toBeUndefined();
      } finally {
        db.close();
      }
    });
  });

  describe('moveMap', () => {
    it('sets a map\'s folder_id', async () => {
      const { db, asyncDb } = createDatabase();
      const { createFolder, moveMap } = await getMapFolderService();
      try {
        db.prepare(`INSERT INTO maps (id, title) VALUES (?, ?)`).run('map-1', 'Test Map');
        const { id: folderId } = await createFolder(asyncDb, { name: 'Dungeons' });
        await moveMap(asyncDb, 'map-1', folderId);
        const row = db.prepare('SELECT folder_id FROM maps WHERE id = ?').get('map-1') as { folder_id: string | null };
        expect(row.folder_id).toBe(folderId);
      } finally {
        db.close();
      }
    });

    it('ungroups a map with folderId = null', async () => {
      const { db, asyncDb } = createDatabase();
      const { createFolder, moveMap } = await getMapFolderService();
      try {
        db.prepare(`INSERT INTO maps (id, title, folder_id) VALUES (?, ?, ?)`).run('map-1', 'Test Map', 'mapfolder_x');
        await moveMap(asyncDb, 'map-1', null);
        const row = db.prepare('SELECT folder_id FROM maps WHERE id = ?').get('map-1') as { folder_id: string | null };
        expect(row.folder_id).toBeNull();
      } finally {
        db.close();
      }
    });
  });

  describe('moveFolder (reparent): rejects self/descendant drop', () => {
    it('reparenting a folder under a normal other folder succeeds', async () => {
      const { db, asyncDb } = createDatabase();
      const { createFolder, moveFolder, listFolders } = await getMapFolderService();
      try {
        const { id: a } = await createFolder(asyncDb, { name: 'A' });
        const { id: b } = await createFolder(asyncDb, { name: 'B' });
        await moveFolder(asyncDb, b, a);
        const folders = await listFolders(asyncDb);
        expect(folders.find((f) => f.id === b)?.parent_id).toBe(a);
      } finally {
        db.close();
      }
    });

    it('rejects reparenting a folder onto itself', async () => {
      const { db, asyncDb } = createDatabase();
      const { createFolder, moveFolder } = await getMapFolderService();
      try {
        const { id: a } = await createFolder(asyncDb, { name: 'A' });
        await expect(moveFolder(asyncDb, a, a)).rejects.toThrow();
      } finally {
        db.close();
      }
    });

    it('rejects reparenting a folder onto its own descendant', async () => {
      const { db, asyncDb } = createDatabase();
      const { createFolder, moveFolder } = await getMapFolderService();
      try {
        const { id: parent } = await createFolder(asyncDb, { name: 'Parent' });
        const { id: child } = await createFolder(asyncDb, { name: 'Child', parent_id: parent });
        await expect(moveFolder(asyncDb, parent, child)).rejects.toThrow();
      } finally {
        db.close();
      }
    });
  });
});
