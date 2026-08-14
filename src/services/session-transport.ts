import { invoke } from '@tauri-apps/api/core';

const DEFAULT_PORT = 9010;

export interface ServerInfo {
  url: string;
  port: number;
}

export interface ClientMessage {
  type: string;
  payload: Record<string, unknown>;
}

export interface SessionTransport {
  send(playerId: string, message: ClientMessage): Promise<void>;
  broadcast(message: ClientMessage): Promise<void>;
  onMessage(handler: (playerId: string, message: ClientMessage) => void): void;
  disconnect(playerId: string): Promise<void>;
}

export async function startSessionServer(port: number = DEFAULT_PORT): Promise<ServerInfo> {
  return invoke<ServerInfo>('start_session_server', { port });
}

export async function stopSessionServer(): Promise<void> {
  return invoke('stop_session_server');
}

export function createSessionTransport(): SessionTransport {
  return {
    async send(playerId, message) {
      await invoke('send_to_player', { playerId, message });
    },
    async broadcast(message) {
      await invoke('broadcast_to_players', { message });
    },
    onMessage(_handler) {
      // Tauri event listener wired in a later story (S09/S18)
    },
    async disconnect(playerId) {
      await invoke('disconnect_player', { playerId });
    },
  };
}

export function validateIncomingMessage(raw: unknown): ClientMessage {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid message: must be a non-null object');
  }
  const obj = raw as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== 2 || !keys.includes('type') || !keys.includes('payload')) {
    throw new Error('Invalid message: must have exactly type and payload fields');
  }
  if (typeof obj.type !== 'string') {
    throw new Error('Invalid message: type must be a string');
  }
  if (obj.payload === null || typeof obj.payload !== 'object' || Array.isArray(obj.payload)) {
    throw new Error('Invalid message: payload must be a non-null object');
  }
  return obj as unknown as ClientMessage;
}
