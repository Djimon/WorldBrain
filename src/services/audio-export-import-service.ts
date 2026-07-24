// M15-S21 (#311): Audio-Soundboard Export/Import — komplette Board-
// Konfiguration (Szenen/Kanäle/Clips) als JSON teilbar.
//
// Design entschieden (Interview 2026-07-22):
// D-A Lokale Dateien = nur Referenz, Re-Link beim Import. Kein Datei-Bündeln.
// D-B Kollision beim Import = immer additiv ("Name (2)", "Name (3)", ...).
//     Kein Merge, kein Überschreiben.
// D-C Schema-Version im Export-Root (schema_version), unbekannte Version
//     beim Import -> klare Fehlermeldung (gerenderte UI, kein Browser-Dialog).
import type { DatabaseLike } from './entity-service';
import type { ChannelMode, SourceType, TransitionType } from './audio-service';

export const AUDIO_EXPORT_SCHEMA_VERSION = 1;

// Reine Referenz auf Datenmodell-Felder aus audio-service.ts — keine ids,
// kein created_at (neue ids werden beim Import vergeben).
export interface AudioExportClip {
  order_index: number;
  source_type: SourceType;
  source_ref: string;
  base_volume: number;
  label: string | null;
  icon: string | null;
  color: string | null;
  loop: boolean;
}

export interface AudioExportChannel {
  name: string | null;
  order_index: number;
  mode: ChannelMode;
  volume: number;
  balance: number;
  eq_low: number;
  eq_mid: number;
  eq_high: number;
  muted: boolean;
  transition_type: TransitionType;
  transition_seconds: number;
  clips: AudioExportClip[];
}

export interface AudioExportScene {
  name: string;
  order_index: number;
  channels: AudioExportChannel[];
}

export interface AudioExportFile {
  schema_version: number;
  scenes: AudioExportScene[];
}

// AC 2: liest die ausgewählten Szenen vollständig (listScene je Szene) und
// baut die exportierbare, id-freie Repräsentation.
export function exportScenesToJson(_db: DatabaseLike, _sceneIds: string[]): Promise<AudioExportFile> {
  throw new Error('not implemented');
}

export interface AudioImportUnlinkedFile {
  clipLabel: string | null;
  sourceRef: string;
}

export interface AudioImportResult {
  importedSceneIds: string[];
  unlinkedFiles: AudioImportUnlinkedFile[];
}

// Geworfen bei kaputtem/fremdem JSON (kein Objekt, unbekannte
// schema_version, `scenes` fehlt/kein Array) — AC 7 verlangt eine klare,
// gerenderte Fehlermeldung statt eines Browser-Dialogs; dieser Fehlertyp
// ist der Kontrakt, den die UI-Schicht abfängt und rendert.
export class InvalidAudioExportError extends Error {}

// AC 3/5/6: validiert grob, persistiert additiv (D-B: Namenskollision ->
// " (2)", " (3)", ... statt Merge/Überschreiben), markiert fehlende lokale
// Dateien als "nicht verknüpft" (D-A) statt den Import abzubrechen.
export function importAudioBoardFromJson(_db: DatabaseLike, _data: unknown): Promise<AudioImportResult> {
  throw new Error('not implemented');
}
