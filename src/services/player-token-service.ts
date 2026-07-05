// M10-S10: Reconnect & Token-Persistenz (EPIC-016)
// Token is stored locally on the player client via @tauri-apps/plugin-fs, one
// file per session/player under the app data dir. Never logged.
import { mkdir, readTextFile, remove, writeTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

interface TokenFileParams {
  appDataDir: string;
  sessionId: string;
  playerId: string;
}

async function tokenPath(params: TokenFileParams): Promise<string> {
  return join(params.appDataDir, 'player-tokens', params.sessionId, `${params.playerId}.json`);
}

export async function savePlayerToken(
  params: TokenFileParams & { token: string },
): Promise<void> {
  const dir = await join(params.appDataDir, 'player-tokens', params.sessionId);
  await mkdir(dir, { recursive: true });
  const path = await tokenPath(params);
  await writeTextFile(path, JSON.stringify({ token: params.token }));
}

export async function loadPlayerToken(params: TokenFileParams): Promise<string | null> {
  const path = await tokenPath(params);
  let raw: string;
  try {
    // Missing token file (not yet joined / cleared) → no crash.
    raw = await readTextFile(path);
  } catch {
    return null;
  }
  try {
    // Corrupt token file → safe fallback (AP-006 exception).
    const data = JSON.parse(raw) as { token?: string };
    return data.token ?? null;
  } catch {
    return null;
  }
}

export async function clearPlayerToken(params: TokenFileParams): Promise<void> {
  const path = await tokenPath(params);
  try {
    await remove(path);
  } catch {
    // Already gone — nothing to invalidate.
  }
}
