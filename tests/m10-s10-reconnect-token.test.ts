// M10-S10: Reconnect & Token-Persistenz (Tauri FS — client-side token storage)
// See: https://github.com/Djimon/WorldBrain/issues/204

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  mkdir: vi.fn(),
  exists: vi.fn(),
  remove: vi.fn(),
  readDir: vi.fn(),
}));

vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn((...parts: string[]) => Promise.resolve(parts.join('/'))),
}));

import * as tauriFs from '@tauri-apps/plugin-fs';

const mockReadTextFile  = tauriFs.readTextFile  as ReturnType<typeof vi.fn>;
const mockWriteTextFile = tauriFs.writeTextFile as ReturnType<typeof vi.fn>;
const mockMkdir         = tauriFs.mkdir         as ReturnType<typeof vi.fn>;
const mockExists        = tauriFs.exists        as ReturnType<typeof vi.fn>;
const mockRemove        = tauriFs.remove        as ReturnType<typeof vi.fn>;

async function getTokenService() { return import('../src/services/player-token-service'); }

const APP_DATA_DIR = '/app-data';
const SESSION_ID = 'sess-abc123';
const PLAYER_ID  = 'player-xyz789';
const TOKEN      = 'eyJhbGciOiJIUzI1NiJ9.test';

describe('M10-S10 reconnect & token persistence (Tauri FS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteTextFile.mockResolvedValue(undefined);
    mockExists.mockResolvedValue(true);
    mockRemove.mockResolvedValue(undefined);
  });

  describe('savePlayerToken', () => {
    it('is async', async () => {
      const { savePlayerToken } = await getTokenService();
      expect(savePlayerToken({ appDataDir: APP_DATA_DIR, sessionId: SESSION_ID, playerId: PLAYER_ID, token: TOKEN })).toBeInstanceOf(Promise);
    });

    it('calls writeTextFile with token content', async () => {
      const { savePlayerToken } = await getTokenService();
      await savePlayerToken({ appDataDir: APP_DATA_DIR, sessionId: SESSION_ID, playerId: PLAYER_ID, token: TOKEN });
      const calls = mockWriteTextFile.mock.calls as [string, string][];
      const written = calls.find(([, content]) => content.includes(TOKEN) || content.includes('"token"'));
      expect(written).toBeTruthy();
    });

    it('stores token in session-scoped subdirectory', async () => {
      const { savePlayerToken } = await getTokenService();
      await savePlayerToken({ appDataDir: APP_DATA_DIR, sessionId: SESSION_ID, playerId: PLAYER_ID, token: TOKEN });
      const calls = mockWriteTextFile.mock.calls as [string, string][];
      const pathUsed = calls[0]?.[0] ?? '';
      expect(pathUsed).toContain(SESSION_ID);
    });

    it('calls mkdir with recursive to ensure directory exists', async () => {
      const { savePlayerToken } = await getTokenService();
      await savePlayerToken({ appDataDir: APP_DATA_DIR, sessionId: SESSION_ID, playerId: PLAYER_ID, token: TOKEN });
      expect(mockMkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });
  });

  describe('loadPlayerToken', () => {
    it('is async', async () => {
      mockReadTextFile.mockResolvedValue(JSON.stringify({ token: TOKEN }));
      const { loadPlayerToken } = await getTokenService();
      expect(loadPlayerToken({ appDataDir: APP_DATA_DIR, sessionId: SESSION_ID, playerId: PLAYER_ID })).toBeInstanceOf(Promise);
    });

    it('returns the saved token string', async () => {
      mockReadTextFile.mockResolvedValue(JSON.stringify({ token: TOKEN }));
      const { loadPlayerToken } = await getTokenService();
      const result = await loadPlayerToken({ appDataDir: APP_DATA_DIR, sessionId: SESSION_ID, playerId: PLAYER_ID });
      expect(result).toBe(TOKEN);
    });

    it('returns null when no token file exists (ENOENT)', async () => {
      mockReadTextFile.mockRejectedValue(new Error('ENOENT: file not found'));
      const { loadPlayerToken } = await getTokenService();
      const result = await loadPlayerToken({ appDataDir: APP_DATA_DIR, sessionId: SESSION_ID, playerId: PLAYER_ID });
      expect(result).toBeNull();
    });

    it('returns null for corrupt token file (not a crash)', async () => {
      mockReadTextFile.mockResolvedValue('not-json{{{');
      const { loadPlayerToken } = await getTokenService();
      const result = await loadPlayerToken({ appDataDir: APP_DATA_DIR, sessionId: SESSION_ID, playerId: PLAYER_ID });
      expect(result).toBeNull();
    });
  });

  describe('clearPlayerToken (kick invalidation)', () => {
    it('is async', async () => {
      const { clearPlayerToken } = await getTokenService();
      expect(clearPlayerToken({ appDataDir: APP_DATA_DIR, sessionId: SESSION_ID, playerId: PLAYER_ID })).toBeInstanceOf(Promise);
    });

    it('calls remove on the token file', async () => {
      const { clearPlayerToken } = await getTokenService();
      await clearPlayerToken({ appDataDir: APP_DATA_DIR, sessionId: SESSION_ID, playerId: PLAYER_ID });
      expect(mockRemove).toHaveBeenCalled();
    });

    it('does not throw when token file does not exist', async () => {
      mockRemove.mockRejectedValue(new Error('ENOENT'));
      const { clearPlayerToken } = await getTokenService();
      await expect(clearPlayerToken({ appDataDir: APP_DATA_DIR, sessionId: SESSION_ID, playerId: PLAYER_ID })).resolves.not.toThrow();
    });
  });

  describe('reconnect flow', () => {
    it('loaded token (valid + approved) does not require re-approval (approved status checked by caller)', async () => {
      mockReadTextFile.mockResolvedValue(JSON.stringify({ token: TOKEN }));
      const { loadPlayerToken } = await getTokenService();
      const result = await loadPlayerToken({ appDataDir: APP_DATA_DIR, sessionId: SESSION_ID, playerId: PLAYER_ID });
      expect(result).not.toBeNull();
    });
  });

  describe('security constraints', () => {
    it('player-token-service.ts never logs the token value', () => {
      const src = require('fs').readFileSync('src/services/player-token-service.ts', 'utf-8');
      expect(src).not.toMatch(/console\.(log|info|warn|debug)\(.*token/i);
    });

    it('player-token-service.ts uses only Tauri plugin-fs (not node:fs)', () => {
      const src = require('fs').readFileSync('src/services/player-token-service.ts', 'utf-8');
      expect(src).not.toMatch(/from ['"](?:node:)?fs['"]/);
    });
  });
});
