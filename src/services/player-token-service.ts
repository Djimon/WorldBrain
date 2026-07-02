// M10-S10: Stub — implement in RED→GREEN phase
// Token is stored locally on the player client via @tauri-apps/plugin-fs
import { mkdir, readTextFile, remove, writeTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

export async function savePlayerToken(_: { appDataDir: string; sessionId: string; playerId: string; token: string }): Promise<void> { throw new Error('not implemented'); }
export async function loadPlayerToken(_: { appDataDir: string; sessionId: string; playerId: string }): Promise<string | null> { throw new Error('not implemented'); }
export async function clearPlayerToken(_: { appDataDir: string; sessionId: string; playerId: string }): Promise<void> { throw new Error('not implemented'); }

// keep imports referenced to avoid tree-shaking stripping them before lint
void mkdir; void readTextFile; void remove; void writeTextFile; void join;
