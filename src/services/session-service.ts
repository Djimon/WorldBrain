import { mkdir, readDir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

/**
 * A play session is a persisted JSON object under `sessions/<id>.json` in the
 * project folder. The world (project) is system-agnostic; the rule system is
 * chosen per session via `system_plugin_id`. See EPIC-013 / M8-S01.
 */
export interface Session {
  id: string;
  title: string;
  project_id: string;
  system_plugin_id?: string | null;
  created_at: string;
  last_active_at: string;
  calendar_position: number | null;
  archived: boolean;
  active: boolean;
}

export interface CreateSessionParams {
  projectDir: string;
  title: string;
  projectId: string;
  systemPluginId?: string;
}

// Crockford Base32 — digits + uppercase letters, matches /^[0-9A-Z]{26}$/.
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodeTime(time: number, length: number): string {
  let str = '';
  for (let i = length - 1; i >= 0; i--) {
    str = ENCODING[time % 32] + str;
    time = Math.floor(time / 32);
  }
  return str;
}

function encodeRandom(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let str = '';
  for (let i = 0; i < length; i++) {
    str += ENCODING[bytes[i] % 32];
  }
  return str;
}

/** Generate a ULID: 48-bit timestamp (10 chars) + 80-bit randomness (16 chars). */
function generateUlid(): string {
  return encodeTime(Date.now(), 10) + encodeRandom(16);
}

async function sessionsDir(projectDir: string): Promise<string> {
  return join(projectDir, 'sessions');
}

async function sessionPath(projectDir: string, sessionId: string): Promise<string> {
  return join(await sessionsDir(projectDir), `${sessionId}.json`);
}

export async function createSession(params: CreateSessionParams): Promise<Session> {
  const now = new Date().toISOString();
  const session: Session = {
    id: generateUlid(),
    title: params.title,
    project_id: params.projectId,
    system_plugin_id: params.systemPluginId ?? null,
    created_at: now,
    last_active_at: now,
    calendar_position: null,
    archived: false,
    active: false,
  };
  await mkdir(await sessionsDir(params.projectDir), { recursive: true });
  await saveSession({ projectDir: params.projectDir, session });
  return session;
}

export async function loadSession(params: { projectDir: string; sessionId: string }): Promise<Session | null> {
  const path = await sessionPath(params.projectDir, params.sessionId);
  let raw: string;
  try {
    // Missing/unreadable session file → no crash (AC).
    raw = await readTextFile(path);
  } catch {
    return null;
  }
  try {
    // Corrupt JSON → safe fallback (AP-006 filesystem/JSON exception).
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function saveSession(params: { projectDir: string; session: Session }): Promise<void> {
  const path = await sessionPath(params.projectDir, params.session.id);
  await writeTextFile(path, JSON.stringify(params.session, null, 2));
}

export async function listSessions(params: { projectDir: string; includeArchived?: boolean }): Promise<Session[]> {
  const dir = await sessionsDir(params.projectDir);
  let entries: { name: string }[];
  try {
    entries = await readDir(dir);
  } catch {
    // Missing sessions directory → no sessions yet.
    return [];
  }
  const sessions: Session[] = [];
  for (const entry of entries) {
    const sessionId = entry.name.replace(/\.json$/, '');
    const session = await loadSession({ projectDir: params.projectDir, sessionId });
    if (!session) continue;
    if (!params.includeArchived && session.archived) continue;
    sessions.push(session);
  }
  return sessions;
}

export async function archiveSession(params: { projectDir: string; sessionId: string }): Promise<void> {
  const session = await loadSession({ projectDir: params.projectDir, sessionId: params.sessionId });
  if (!session) return;
  session.archived = true;
  await saveSession({ projectDir: params.projectDir, session });
}

/** Activate a session; only one session per project may be active at a time. */
export async function activateSession(params: { projectDir: string; sessionId: string }): Promise<void> {
  const all = await listSessions({ projectDir: params.projectDir, includeArchived: true });
  for (const other of all) {
    if (other.id !== params.sessionId && other.active) {
      other.active = false;
      await saveSession({ projectDir: params.projectDir, session: other });
    }
  }
  const target = await loadSession({ projectDir: params.projectDir, sessionId: params.sessionId });
  if (!target) return;
  target.active = true;
  target.last_active_at = new Date().toISOString();
  await saveSession({ projectDir: params.projectDir, session: target });
}

export async function getActiveSession(params: { projectDir: string }): Promise<Session | null> {
  const all = await listSessions({ projectDir: params.projectDir, includeArchived: true });
  return all.find((s) => s.active) ?? null;
}
