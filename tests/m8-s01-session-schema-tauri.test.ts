// M8-S01: Session-Schema & Persistenz — Tauri Plugin Mocks
// Ersetzt m8-s01-session-schema.test.ts.deprecated nach Tauri-Migration (#190)
// See: https://github.com/Djimon/WorldBrain/issues/152

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  mkdir: vi.fn(),
  exists: vi.fn(),
  readDir: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn((...parts: string[]) => Promise.resolve(parts.join('/'))),
}));

import * as tauriFs from '@tauri-apps/plugin-fs';

const mockReadTextFile  = tauriFs.readTextFile  as ReturnType<typeof vi.fn>;
const mockWriteTextFile = tauriFs.writeTextFile as ReturnType<typeof vi.fn>;
const mockMkdir         = tauriFs.mkdir         as ReturnType<typeof vi.fn>;
const mockExists        = tauriFs.exists        as ReturnType<typeof vi.fn>;
const mockReadDir       = tauriFs.readDir       as ReturnType<typeof vi.fn>;

async function getSessionService() { return import('../src/services/session-service'); }

const PROJECT_DIR = '/projects/my-world';

// In-memory FS store for write→read round-trip tests.
function makeFileStore() {
  const store = new Map<string, string>();
  mockWriteTextFile.mockImplementation(async (p: string, c: string) => { store.set(p, c); });
  mockReadTextFile.mockImplementation(async (p: string) => {
    const v = store.get(p);
    if (v === undefined) throw new Error(`ENOENT: ${p}`);
    return v;
  });
  mockReadDir.mockImplementation(async (dir: string) =>
    [...store.keys()]
      .filter(p => p.startsWith(dir) && p.endsWith('.json'))
      .map(p => ({ name: p.split('/').pop()!.replace('.json', ''), isFile: true, isDirectory: false })),
  );
  return store;
}

describe('M8-S01 session schema & persistence (Tauri)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteTextFile.mockResolvedValue(undefined);
    mockExists.mockResolvedValue(true);
    mockReadDir.mockResolvedValue([]);
  });

  describe('createSession', () => {
    it('is async (returns a Promise)', async () => {
      const { createSession } = await getSessionService();
      const result = createSession({ projectDir: PROJECT_DIR, title: 'S1', projectId: 'proj-1' });
      expect(result).toBeInstanceOf(Promise);
    });

    it('returns a session with id, title, project_id, created_at, last_active_at', async () => {
      const { createSession } = await getSessionService();
      const session = await createSession({ projectDir: PROJECT_DIR, title: 'Session 1', projectId: 'proj-1' });
      expect(session.id).toBeTruthy();
      expect(session.title).toBe('Session 1');
      expect(session.project_id).toBe('proj-1');
      expect(session.created_at).toBeTruthy();
      expect(session.last_active_at).toBeTruthy();
    });

    it('id is a ULID — 26 uppercase alphanumeric characters', async () => {
      const { createSession } = await getSessionService();
      const session = await createSession({ projectDir: PROJECT_DIR, title: 'S1', projectId: 'proj-1' });
      expect(session.id).toMatch(/^[0-9A-Z]{26}$/);
    });

    it('new session has archived: false by default', async () => {
      const { createSession } = await getSessionService();
      const session = await createSession({ projectDir: PROJECT_DIR, title: 'S1', projectId: 'proj-1' });
      expect(session.archived).toBe(false);
    });

    it('calls writeTextFile to persist session JSON under sessions/<id>.json', async () => {
      const { createSession } = await getSessionService();
      const session = await createSession({ projectDir: PROJECT_DIR, title: 'S1', projectId: 'proj-1' });
      const writeCalls = mockWriteTextFile.mock.calls as [string, string][];
      const sessionWrite = writeCalls.find(([p]) => p.includes('sessions') && p.includes(session.id));
      expect(sessionWrite).toBeTruthy();
    });

    it('persisted JSON includes all required schema fields', async () => {
      const { createSession } = await getSessionService();
      const session = await createSession({ projectDir: PROJECT_DIR, title: 'Schema Test', projectId: 'proj-1' });
      const writeCalls = mockWriteTextFile.mock.calls as [string, string][];
      const sessionWrite = writeCalls.find(([p]) => p.includes(session.id));
      const data = JSON.parse(sessionWrite![1]);
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('title');
      expect(data).toHaveProperty('project_id');
      expect(data).toHaveProperty('created_at');
      expect(data).toHaveProperty('last_active_at');
      expect(data).toHaveProperty('archived');
      expect(data).toHaveProperty('calendar_position');
    });

    it('system_plugin_id is optional (null or absent)', async () => {
      const { createSession } = await getSessionService();
      const session = await createSession({ projectDir: PROJECT_DIR, title: 'No Plugin', projectId: 'proj-1' });
      expect(session.system_plugin_id === undefined || session.system_plugin_id === null).toBe(true);
    });

    it('accepts system_plugin_id when provided', async () => {
      const { createSession } = await getSessionService();
      const session = await createSession({ projectDir: PROJECT_DIR, title: 'DnD', projectId: 'proj-1', systemPluginId: 'dnd5e-srd' });
      expect(session.system_plugin_id).toBe('dnd5e-srd');
    });
  });

  describe('loadSession', () => {
    it('is async (returns a Promise)', async () => {
      mockReadTextFile.mockResolvedValue(JSON.stringify({ id: 'S1', title: 'T', project_id: 'p', created_at: '', last_active_at: '', archived: false, calendar_position: null }));
      const { loadSession } = await getSessionService();
      const result = loadSession({ projectDir: PROJECT_DIR, sessionId: 'S1' });
      expect(result).toBeInstanceOf(Promise);
    });

    it('loads session from sessions/<id>.json via readTextFile', async () => {
      const payload = { id: 'SESS01', title: 'Load Me', project_id: 'proj-1', created_at: '2026-01-01T00:00:00Z', last_active_at: '2026-01-01T00:00:00Z', archived: false, calendar_position: null };
      mockReadTextFile.mockResolvedValue(JSON.stringify(payload));
      const { loadSession } = await getSessionService();
      const loaded = await loadSession({ projectDir: PROJECT_DIR, sessionId: 'SESS01' });
      expect(loaded?.title).toBe('Load Me');
      expect(loaded?.id).toBe('SESS01');
    });

    it('returns null (not a crash) when readTextFile throws ENOENT', async () => {
      mockReadTextFile.mockRejectedValue(new Error('ENOENT: file not found'));
      const { loadSession } = await getSessionService();
      const result = await loadSession({ projectDir: PROJECT_DIR, sessionId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' });
      expect(result).toBeNull();
    });

    it('returns null (not a crash) for corrupt session JSON', async () => {
      mockReadTextFile.mockResolvedValue('not-json{{{');
      const { loadSession } = await getSessionService();
      const result = await loadSession({ projectDir: PROJECT_DIR, sessionId: '01ARZ3NDEKTSV4RRFFQ69G5FAX' });
      expect(result).toBeNull();
    });
  });

  describe('saveSession', () => {
    it('is async (returns a Promise)', async () => {
      const { saveSession } = await getSessionService();
      const session = { id: 'S1', title: 'T', project_id: 'p', created_at: '', last_active_at: '', archived: false, calendar_position: null };
      const result = saveSession({ projectDir: PROJECT_DIR, session });
      expect(result).toBeInstanceOf(Promise);
    });

    it('calls writeTextFile with the updated session JSON', async () => {
      const { saveSession } = await getSessionService();
      const session = { id: 'SESS01', title: 'After Save', project_id: 'proj-1', created_at: '2026-01-01T00:00:00Z', last_active_at: '2026-01-01T00:00:00Z', archived: false, calendar_position: null };
      await saveSession({ projectDir: PROJECT_DIR, session });
      const writeCalls = mockWriteTextFile.mock.calls as [string, string][];
      const call = writeCalls.find(([p]) => p.includes('SESS01'));
      expect(call).toBeTruthy();
      expect(JSON.parse(call![1]).title).toBe('After Save');
    });

    it('persists changes: write→read round-trip', async () => {
      makeFileStore();
      const { createSession, saveSession, loadSession } = await getSessionService();
      const session = await createSession({ projectDir: PROJECT_DIR, title: 'Before Save', projectId: 'proj-1' });
      session.title = 'After Save';
      await saveSession({ projectDir: PROJECT_DIR, session });
      const reloaded = await loadSession({ projectDir: PROJECT_DIR, sessionId: session.id });
      expect(reloaded?.title).toBe('After Save');
    });
  });

  describe('listSessions', () => {
    it('is async (returns a Promise)', async () => {
      mockReadDir.mockResolvedValue([]);
      const { listSessions } = await getSessionService();
      expect(listSessions({ projectDir: PROJECT_DIR })).toBeInstanceOf(Promise);
    });

    it('returns empty array when readDir returns no entries', async () => {
      mockReadDir.mockResolvedValue([]);
      const { listSessions } = await getSessionService();
      expect(await listSessions({ projectDir: PROJECT_DIR })).toEqual([]);
    });

    it('returns all non-archived sessions', async () => {
      makeFileStore();
      const { createSession, listSessions } = await getSessionService();
      await createSession({ projectDir: PROJECT_DIR, title: 'Session A', projectId: 'proj-1' });
      await createSession({ projectDir: PROJECT_DIR, title: 'Session B', projectId: 'proj-1' });
      const list = await listSessions({ projectDir: PROJECT_DIR });
      expect(list.length).toBe(2);
    });

    it('skips corrupt session files gracefully', async () => {
      const store = makeFileStore();
      const { createSession, listSessions } = await getSessionService();
      await createSession({ projectDir: PROJECT_DIR, title: 'Good Session', projectId: 'proj-1' });
      // inject a corrupt entry into the store directly
      store.set(`${PROJECT_DIR}/sessions/BADFILE.json`, 'not-json');
      const list = await listSessions({ projectDir: PROJECT_DIR });
      expect(list.length).toBe(1);
      expect(list[0].title).toBe('Good Session');
    });
  });

  describe('archiveSession', () => {
    it('is async (returns a Promise)', async () => {
      makeFileStore();
      const { createSession, archiveSession } = await getSessionService();
      const s = await createSession({ projectDir: PROJECT_DIR, title: 'A', projectId: 'proj-1' });
      expect(archiveSession({ projectDir: PROJECT_DIR, sessionId: s.id })).toBeInstanceOf(Promise);
    });

    it('sets archived: true in written JSON', async () => {
      makeFileStore();
      const { createSession, archiveSession } = await getSessionService();
      const session = await createSession({ projectDir: PROJECT_DIR, title: 'Archive Me', projectId: 'proj-1' });
      await archiveSession({ projectDir: PROJECT_DIR, sessionId: session.id });
      const loaded = await mockReadTextFile(`${PROJECT_DIR}/sessions/${session.id}.json`);
      expect(JSON.parse(loaded).archived).toBe(true);
    });

    it('archived sessions are excluded from listSessions', async () => {
      makeFileStore();
      const { createSession, archiveSession, listSessions } = await getSessionService();
      const session = await createSession({ projectDir: PROJECT_DIR, title: 'Gone', projectId: 'proj-1' });
      await archiveSession({ projectDir: PROJECT_DIR, sessionId: session.id });
      const list = await listSessions({ projectDir: PROJECT_DIR });
      expect(list.every(s => s.id !== session.id)).toBe(true);
    });

    it('archived sessions appear in listSessions({ includeArchived: true })', async () => {
      makeFileStore();
      const { createSession, archiveSession, listSessions } = await getSessionService();
      const session = await createSession({ projectDir: PROJECT_DIR, title: 'Archived One', projectId: 'proj-1' });
      await archiveSession({ projectDir: PROJECT_DIR, sessionId: session.id });
      const list = await listSessions({ projectDir: PROJECT_DIR, includeArchived: true });
      expect(list.some(s => s.id === session.id)).toBe(true);
    });
  });

  describe('activateSession / getActiveSession', () => {
    it('activateSession is async (returns a Promise)', async () => {
      makeFileStore();
      const { createSession, activateSession } = await getSessionService();
      const s = await createSession({ projectDir: PROJECT_DIR, title: 'S', projectId: 'proj-1' });
      expect(activateSession({ projectDir: PROJECT_DIR, sessionId: s.id })).toBeInstanceOf(Promise);
    });

    it('activating a session marks it active and deactivates the previous', async () => {
      makeFileStore();
      const { createSession, activateSession, loadSession } = await getSessionService();
      const s1 = await createSession({ projectDir: PROJECT_DIR, title: 'First', projectId: 'proj-1' });
      const s2 = await createSession({ projectDir: PROJECT_DIR, title: 'Second', projectId: 'proj-1' });
      await activateSession({ projectDir: PROJECT_DIR, sessionId: s1.id });
      await activateSession({ projectDir: PROJECT_DIR, sessionId: s2.id });
      expect((await loadSession({ projectDir: PROJECT_DIR, sessionId: s1.id }))?.active).toBe(false);
      expect((await loadSession({ projectDir: PROJECT_DIR, sessionId: s2.id }))?.active).toBe(true);
    });

    it('getActiveSession returns the currently active session', async () => {
      makeFileStore();
      const { createSession, activateSession, getActiveSession } = await getSessionService();
      const s = await createSession({ projectDir: PROJECT_DIR, title: 'Active One', projectId: 'proj-1' });
      await activateSession({ projectDir: PROJECT_DIR, sessionId: s.id });
      const active = await getActiveSession({ projectDir: PROJECT_DIR });
      expect(active?.id).toBe(s.id);
    });

    it('getActiveSession returns null when no session is active', async () => {
      mockReadDir.mockResolvedValue([]);
      const { getActiveSession } = await getSessionService();
      const active = await getActiveSession({ projectDir: PROJECT_DIR });
      expect(active).toBeNull();
    });
  });

  describe('no direct node:fs usage', () => {
    it('session-service.ts does not import from node:fs', async () => {
      const src = await import('fs').then(fs => fs.readFileSync('src/services/session-service.ts', 'utf-8'));
      expect(src).not.toMatch(/from ['"](?:node:)?fs['"]/);
    });
  });
});
