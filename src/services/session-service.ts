// M8-S01: Session-Schema & Persistenz
// Stub — wird durch Tauri-async-Implementierung ersetzt.
// See: https://github.com/Djimon/WorldBrain/issues/152

export type Session = {
  id: string;
  title: string;
  project_id: string;
  created_at: string;
  last_active_at: string;
  archived: boolean;
  active?: boolean;
  calendar_position: unknown;
  system_plugin_id?: string | null;
};

export async function createSession(_input: { projectDir: string; title: string; projectId: string; systemPluginId?: string }): Promise<Session> {
  throw new Error('not implemented');
}

export async function loadSession(_input: { projectDir: string; sessionId: string }): Promise<Session | null> {
  throw new Error('not implemented');
}

export async function saveSession(_input: { projectDir: string; session: Session }): Promise<void> {
  throw new Error('not implemented');
}

export async function listSessions(_input: { projectDir: string; includeArchived?: boolean }): Promise<Session[]> {
  throw new Error('not implemented');
}

export async function archiveSession(_input: { projectDir: string; sessionId: string }): Promise<void> {
  throw new Error('not implemented');
}

export async function activateSession(_input: { projectDir: string; sessionId: string }): Promise<void> {
  throw new Error('not implemented');
}

export async function getActiveSession(_input: { projectDir: string }): Promise<Session | null> {
  throw new Error('not implemented');
}
