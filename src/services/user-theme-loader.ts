// #388 — Importierbare User-Themes. Scannt <appDataDir>/themes/*.json, validiert
// jede Datei gegen das Story-Format und registriert valide Themes in der Registry
// (theme-registry.ts). Invalide Dateien werden übersprungen (Grund geloggt), die
// übrigen laden weiter. Muster analog src/services/plugin-loader.ts.
//
// Nur FARBEN sind themebar: palette-Overrides (--color-*) + fünf Mode-Accents.
// Geometrie (Radien/Spacing/Schatten-Pixel) ist NICHT themebar.
import { readDir, readTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import {
  registerTheme, THEMEABLE_COLOR_TOKENS,
  type ThemeDef, type AccentTokens, type AppearanceSkin, type Appearance, type ShellMode,
} from '../styles/theme-registry';

// ── Datei-Format (DTO) ──────────────────────────────────────────────────────
interface AccentSetDto { accent: string; hover: string; on: string; text: string; soft: string; }
interface BlockDto { palette?: Record<string, unknown>; accents?: unknown; }
interface UserThemeDto {
  id?: unknown; label?: unknown; appearance?: unknown; modeSupport?: unknown;
  dark?: unknown; light?: unknown;
}

export type ValidationResult =
  | { ok: true; def: ThemeDef }
  | { ok: false; reason: string };

const ID_RE = /^[a-z0-9-]+$/;
// #392: Farbwerte, die keine reinen Farbliterale sind, ablehnen — verhindert,
// dass ein Fremd-Theme via `url(...)` einen ausgehenden Request (Tracking/Exfil-
// Beacon) in die CSS-Kaskade schmuggelt, oder via `;`/`@import`/Kommentar aus der
// Deklaration ausbricht. Kein Script (kein XSS), aber ein Netzwerk-Side-Effect.
const UNSAFE_VALUE_RE = /url\(|expression\(|@import|;|\/\*/i;
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
/** Nicht-leerer String, der wie ein Farbliteral aussieht (kein url()/;/@import/…). */
const isSafeColorValue = (v: unknown): v is string => isStr(v) && !UNSAFE_VALUE_RE.test(v);

/** Ein Accent-Satz muss alle fünf Felder als sichere Farbliterale tragen. */
function validAccentSet(v: unknown): v is AccentSetDto {
  return isObj(v)
    && isSafeColorValue(v.accent) && isSafeColorValue(v.hover) && isSafeColorValue(v.on)
    && isSafeColorValue(v.text) && isSafeColorValue(v.soft);
}

function accentSetToTokens(dto: AccentSetDto): AccentTokens {
  return {
    '--mode-accent': dto.accent,
    '--mode-accent-hover': dto.hover,
    '--mode-accent-on': dto.on,
    '--mode-accent-text': dto.text,
    '--mode-accent-soft': dto.soft,
  };
}

/** Validiert einen Erscheinungs-Block und mappt ihn auf einen AppearanceSkin.
 *  Rückgabe: Skin oder eine Fehlerbegründung. */
function validateBlock(block: unknown, modeSupport: 'unified' | 'per-mode', where: string):
  { skin: AppearanceSkin } | { reason: string } {
  if (!isObj(block)) return { reason: `block '${where}' missing or not an object` };
  const b = block as BlockDto;

  // palette (optional): nur bekannte --color-*-Namen, Werte als Strings.
  let palette: Record<string, string> | undefined;
  if (b.palette !== undefined) {
    if (!isObj(b.palette)) return { reason: `'${where}.palette' is not an object` };
    palette = {};
    for (const [name, value] of Object.entries(b.palette)) {
      if (!THEMEABLE_COLOR_TOKENS.has(name)) return { reason: `'${where}.palette' has unknown token '${name}'` };
      if (!isSafeColorValue(value)) return { reason: `'${where}.palette.${name}' is not a safe colour literal (no url()/;/@import)` };
      palette[name] = value;
    }
  }

  // accents (Pflicht): per-mode → {edit,play}; unified → flacher Satz.
  const accents = b.accents;
  let tokens: Partial<Record<ShellMode, AccentTokens>>;
  if (modeSupport === 'per-mode') {
    if (!isObj(accents)) return { reason: `'${where}.accents' missing (need { edit, play })` };
    const a = accents as { edit?: unknown; play?: unknown };
    if (!validAccentSet(a.edit)) return { reason: `'${where}.accents.edit' incomplete (need accent/hover/on/text/soft)` };
    if (!validAccentSet(a.play)) return { reason: `'${where}.accents.play' incomplete (need accent/hover/on/text/soft)` };
    tokens = { edit: accentSetToTokens(a.edit), play: accentSetToTokens(a.play) };
  } else {
    if (!validAccentSet(accents)) return { reason: `'${where}.accents' incomplete (need accent/hover/on/text/soft)` };
    tokens = { edit: accentSetToTokens(accents) }; // unified: geteilter Satz unter 'edit'
  }

  return { skin: palette ? { palette, tokens } : { tokens } };
}

/**
 * Validiert ein rohes User-Theme-Objekt gegen das Story-Format und mappt es auf
 * eine Runtime-`ThemeDef`. DTO-Validierung geschieht VOR der Konvertierung.
 */
export function validateUserTheme(raw: unknown): ValidationResult {
  if (!isObj(raw)) return { ok: false, reason: 'not a JSON object' };
  const dto = raw as UserThemeDto;

  if (!isStr(dto.id) || !ID_RE.test(dto.id)) return { ok: false, reason: `invalid or missing 'id' (need ^[a-z0-9-]+$)` };
  if (!isStr(dto.label)) return { ok: false, reason: `missing 'label'` };
  if (dto.appearance !== 'dark' && dto.appearance !== 'light' && dto.appearance !== 'both') {
    return { ok: false, reason: `invalid 'appearance' (need dark|light|both)` };
  }
  if (dto.modeSupport !== 'unified' && dto.modeSupport !== 'per-mode') {
    return { ok: false, reason: `invalid 'modeSupport' (need unified|per-mode)` };
  }
  const appearance = dto.appearance;
  const modeSupport = dto.modeSupport;

  // Welche Erscheinungs-Blöcke sind erforderlich?
  const required: Appearance[] = appearance === 'both' ? ['dark', 'light'] : [appearance];
  const skins: Partial<Record<Appearance, AppearanceSkin>> = {};
  for (const app of required) {
    const res = validateBlock(dto[app], modeSupport, app);
    if ('reason' in res) return { ok: false, reason: res.reason };
    skins[app] = res.skin;
  }

  // Top-Level tokens (Vorschau/Parität): der primäre Skin (dark bevorzugt).
  const primary = skins.dark ?? skins.light;

  const def: ThemeDef = {
    id: dto.id,
    labelKey: `theme.${dto.id}`,
    defaultLabel: dto.label,
    modeSupport,
    appearanceSupport: appearance,
    tokens: primary ? primary.tokens : {},
    skins,
  };
  return { ok: true, def };
}

/** Bequem für Tests / Datei-Laden: JSON-String parsen + validieren. */
export function parseUserTheme(text: string): ValidationResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    // AP-006: JSON.parse an der Lade-Grenze — strukturierter Fallback.
    return { ok: false, reason: 'invalid JSON' };
  }
  return validateUserTheme(raw);
}

export interface ScanResult {
  registered: string[];
  skipped: { file: string; reason: string }[];
}

/**
 * Scannt <themesDir>/*.json, validiert und registriert valide User-Themes.
 * Fehlender/leerer Ordner → leeres Ergebnis (kein Fehler). Invalide Datei oder
 * Kollision mit einer eingebauten ID → übersprungen (Grund geloggt).
 */
export async function scanUserThemes(themesDir: string): Promise<ScanResult> {
  const registered: string[] = [];
  const skipped: { file: string; reason: string }[] = [];
  // #396: doppelte User-IDs innerhalb eines Scans dürfen sich nicht still
  // überschreiben (last-wins). Erste gewinnt (Dateien sind sortiert), weitere
  // werden übersprungen + geloggt — konsistent mit skip-on-invalid.
  const seenIds = new Set<string>();

  let files: string[];
  try {
    files = (await readDir(themesDir))
      .filter((d) => d.isFile && d.name.endsWith('.json'))
      .map((d) => d.name)
      .sort();
  } catch {
    // AP-006: themes-Ordner fehlt oder ist unlesbar — leeres Ergebnis.
    return { registered, skipped };
  }

  for (const file of files) {
    const path = await join(themesDir, file);
    let text: string;
    try {
      text = await readTextFile(path);
    } catch {
      // AP-006: Datei unlesbar — überspringen, andere weiterladen.
      skipped.push({ file, reason: 'unreadable' });
      console.warn(`[user-theme] ${file}: unreadable — skipped`);
      continue;
    }
    const res = parseUserTheme(text);
    if (!res.ok) {
      skipped.push({ file, reason: res.reason });
      console.warn(`[user-theme] ${file}: ${res.reason} — skipped`);
      continue;
    }
    if (seenIds.has(res.def.id)) {
      skipped.push({ file, reason: `duplicate id '${res.def.id}' — ignored` });
      console.warn(`[user-theme] ${file}: duplicate id '${res.def.id}' (already loaded from another file) — ignored`);
      continue;
    }
    if (!registerTheme(res.def)) {
      skipped.push({ file, reason: `id '${res.def.id}' is a built-in — ignored` });
      console.warn(`[user-theme] ${file}: id '${res.def.id}' collides with a built-in theme — ignored`);
      continue;
    }
    seenIds.add(res.def.id);
    registered.push(res.def.id);
  }

  return { registered, skipped };
}
