// @vitest-environment node
// M8-S01: Session-Schema & Persistenz
// See: https://github.com/Djimon/WorldBrain/issues/152

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

async function getSessionService() { return import('../src/services/session-service'); }

let tmpBase: string;
let projectDir: string;

beforeEach(() => {
  tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'wbx-sess-'));
  projectDir = path.join(tmpBase, 'my-project');
  fs.mkdirSync(path.join(projectDir, 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify({ id: 'proj-1', title: 'Test World' }));
});

afterEach(() => {
  fs.rmSync(tmpBase, { recursive: true, force: true });
});

describe('M8-S01 session schema & persistence', () => {
  describe('createSession', () => {
    it('returns a session with id, title, project_id, created_at, last_active_at', async () => {
      const { createSession } = await getSessionService();
      const session = createSession({ projectDir, title: 'Session 1', projectId: 'proj-1' });
      expect(session.id).toBeTruthy();
      expect(session.title).toBe('Session 1');
      expect(session.project_id).toBe('proj-1');
      expect(session.created_at).toBeTruthy();
      expect(session.last_active_at).toBeTruthy();
    });

    it('id is a ULID (26 uppercase alphanumeric characters)', async () => {
      const { createSession } = await getSessionService();
      const session = createSession({ projectDir, title: 'Session 1', projectId: 'proj-1' });
      expect(session.id).toMatch(/^[0-9A-Z]{26}$/);
    });

    it('new session has archived: false by default', async () => {
      const { createSession } = await getSessionService();
      const session = createSession({ projectDir, title: 'Session 1', projectId: 'proj-1' });
      expect(session.archived).toBe(false);
    });

    it('writes sessions/<id>.json to projectDir', async () => {
      const { createSession } = await getSessionService();
      const session = createSession({ projectDir, title: 'Session 1', projectId: 'proj-1' });
      const filePath = path.join(projectDir, 'sessions', `${session.id}.json`);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('persisted JSON includes all required schema fields', async () => {
      const { createSession } = await getSessionService();
      const session = createSession({ projectDir, title: 'Schema Test', projectId: 'proj-1' });
      const filePath = path.join(projectDir, 'sessions', `${session.id}.json`);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('title');
      expect(data).toHaveProperty('project_id');
      expect(data).toHaveProperty('created_at');
      expect(data).toHaveProperty('last_active_at');
      expect(data).toHaveProperty('archived');
      expect(data).toHaveProperty('calendar_position');
    });

    it('system_plugin_id is optional (may be null or absent)', async () => {
      const { createSession } = await getSessionService();
      const session = createSession({ projectDir, title: 'No Plugin', projectId: 'proj-1' });
      // system_plugin_id either not present or null — not required
      expect(session.system_plugin_id === undefined || session.system_plugin_id === null).toBe(true);
    });

    it('accepts system_plugin_id when provided', async () => {
      const { createSession } = await getSessionService();
      const session = createSession({ projectDir, title: 'DnD Session', projectId: 'proj-1', systemPluginId: 'dnd5e-srd' });
      expect(session.system_plugin_id).toBe('dnd5e-srd');
    });
  });

  describe('loadSession', () => {
    it('loads a session from sessions/<id>.json', async () => {
      const { createSession, loadSession } = await getSessionService();
      const created = createSession({ projectDir, title: 'Load Me', projectId: 'proj-1' });
      const loaded = loadSession({ projectDir, sessionId: created.id });
      expect(loaded.title).toBe('Load Me');
      expect(loaded.id).toBe(created.id);
    });

    it('returns null (not a crash) for nonexistent session file', async () => {
      const { loadSession } = await getSessionService();
      const result = loadSession({ projectDir, sessionId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' });
      expect(result).toBeNull();
    });

    it('returns null (not a crash) for corrupt session JSON', async () => {
      const { loadSession } = await getSessionService();
      const badId = '01ARZ3NDEKTSV4RRFFQ69G5FAX';
      fs.writeFileSync(path.join(projectDir, 'sessions', `${badId}.json`), 'not-json{{{');
      const result = loadSession({ projectDir, sessionId: badId });
      expect(result).toBeNull();
    });
  });

  describe('saveSession', () => {
    it('persists changes to session JSON', async () => {
      const { createSession, saveSession, loadSession } = await getSessionService();
      const session = createSession({ projectDir, title: 'Before Save', projectId: 'proj-1' });
      session.title = 'After Save';
      saveSession({ projectDir, session });
      const reloaded = loadSession({ projectDir, sessionId: session.id });
      expect(reloaded?.title).toBe('After Save');
    });
  });

  describe('listSessions', () => {
    it('returns all non-archived sessions', async () => {
      const { createSession, listSessions } = await getSessionService();
      createSession({ projectDir, title: 'Session A', projectId: 'proj-1' });
      createSession({ projectDir, title: 'Session B', projectId: 'proj-1' });
      const list = listSessions({ projectDir });
      expect(list.length).toBe(2);
    });

    it('returns empty array when no sessions exist', async () => {
      const { listSessions } = await getSessionService();
      const list = listSessions({ projectDir });
      expect(list).toEqual([]);
    });

    it('skips corrupt session files gracefully', async () => {
      const { createSession, listSessions } = await getSessionService();
      createSession({ projectDir, title: 'Good Session', projectId: 'proj-1' });
      fs.writeFileSync(path.join(projectDir, 'sessions', 'BAD_FILE.json'), 'not-json');
      const list = listSessions({ projectDir });
      expect(list.length).toBe(1);
      expect(list[0].title).toBe('Good Session');
    });
  });

  describe('archiveSession', () => {
    it('sets archived: true and saves', async () => {
      const { createSession, archiveSession, loadSession } = await getSessionService();
      const session = createSession({ projectDir, title: 'Archive Me', projectId: 'proj-1' });
      archiveSession({ projectDir, sessionId: session.id });
      const loaded = loadSession({ projectDir, sessionId: session.id });
      expect(loaded?.archived).toBe(true);
    });

    it('archived sessions are excluded from listSessions', async () => {
      const { createSession, archiveSession, listSessions } = await getSessionService();
      const session = createSession({ projectDir, title: 'Gone', projectId: 'proj-1' });
      archiveSession({ projectDir, sessionId: session.id });
      const list = listSessions({ projectDir });
      expect(list.every(s => s.id !== session.id)).toBe(true);
    });

    it('archived sessions appear in listSessions({ includeArchived: true })', async () => {
      const { createSession, archiveSession, listSessions } = await getSessionService();
      const session = createSession({ projectDir, title: 'Archived One', projectId: 'proj-1' });
      archiveSession({ projectDir, sessionId: session.id });
      const list = listSessions({ projectDir, includeArchived: true });
      expect(list.some(s => s.id === session.id)).toBe(true);
    });
  });

  describe('active session constraint', () => {
    it('activating a session sets it to active and deactivates the previous', async () => {
      const { createSession, activateSession, loadSession } = await getSessionService();
      const s1 = createSession({ projectDir, title: 'First', projectId: 'proj-1' });
      const s2 = createSession({ projectDir, title: 'Second', projectId: 'proj-1' });
      activateSession({ projectDir, sessionId: s1.id });
      activateSession({ projectDir, sessionId: s2.id });
      expect(loadSession({ projectDir, sessionId: s1.id })?.active).toBe(false);
      expect(loadSession({ projectDir, sessionId: s2.id })?.active).toBe(true);
    });

    it('getActiveSession returns the currently active session', async () => {
      const { createSession, activateSession, getActiveSession } = await getSessionService();
      const s = createSession({ projectDir, title: 'Active One', projectId: 'proj-1' });
      activateSession({ projectDir, sessionId: s.id });
      const active = getActiveSession({ projectDir });
      expect(active?.id).toBe(s.id);
    });

    it('getActiveSession returns null when no session is active', async () => {
      const { getActiveSession } = await getSessionService();
      const active = getActiveSession({ projectDir });
      expect(active).toBeNull();
    });
  });
});
