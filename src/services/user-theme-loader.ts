// #388 — Importable user themes. Scans <appDataDir>/themes/*.json, validates
// each file against the story format and registers valid themes in the registry
// (theme-registry.ts). Invalid files are skipped (reason logged), the
// rest keep loading. Pattern analogous to src/services/plugin-loader.ts.
//
// Only COLORS are themeable: palette overrides (--color-*) + five mode accents.
// Geometry (radii/spacing/shadow pixels) is NOT themeable.
import { readDir, readTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import {
  registerTheme, THEMEABLE_COLOR_TOKENS,
  type ThemeDef, type AccentTokens, type AppearanceSkin, type Appearance, type ShellMode,
} from '../styles/theme-registry';

// ── File format (DTO) ──────────────────────────────────────────────────────
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
// #392: Reject color values that are not pure color literals — prevents
// a foreign theme from smuggling an outgoing request (tracking/exfil
// beacon) into the CSS cascade via `url(...)`, or from breaking out of the
// declaration via `;`/`@import`/comment. No script (no XSS), but a network side effect.
const UNSAFE_VALUE_RE = /url\(|expression\(|@import|;|\/\*/i;
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
/** Non-empty string that looks like a color literal (no url()/;/@import/…). */
const isSafeColorValue = (v: unknown): v is string => isStr(v) && !UNSAFE_VALUE_RE.test(v);

/** An accent set must carry all five fields as safe color literals. */
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

/** Validates an appearance block and maps it to an AppearanceSkin.
 *  Returns: skin or an error reason. */
function validateBlock(block: unknown, modeSupport: 'unified' | 'per-mode', where: string):
  { skin: AppearanceSkin } | { reason: string } {
  if (!isObj(block)) return { reason: `block '${where}' missing or not an object` };
  const b = block as BlockDto;

  // palette (optional): only known --color-* names, values as strings.
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

  // accents (required): per-mode → {edit,play}; unified → flat set.
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
    tokens = { edit: accentSetToTokens(accents) }; // unified: shared set under 'edit'
  }

  return { skin: palette ? { palette, tokens } : { tokens } };
}

/**
 * Validates a raw user-theme object against the story format and maps it to
 * a runtime `ThemeDef`. DTO validation happens BEFORE the conversion.
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

  // Which appearance blocks are required?
  const required: Appearance[] = appearance === 'both' ? ['dark', 'light'] : [appearance];
  const skins: Partial<Record<Appearance, AppearanceSkin>> = {};
  for (const app of required) {
    const res = validateBlock(dto[app], modeSupport, app);
    if ('reason' in res) return { ok: false, reason: res.reason };
    skins[app] = res.skin;
  }

  // Top-level tokens (preview/parity): the primary skin (dark preferred).
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

/** Convenient for tests / file loading: parse + validate a JSON string. */
export function parseUserTheme(text: string): ValidationResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    // AP-006: JSON.parse at the load boundary — structured fallback.
    return { ok: false, reason: 'invalid JSON' };
  }
  return validateUserTheme(raw);
}

export interface ScanResult {
  registered: string[];
  skipped: { file: string; reason: string }[];
}

/**
 * Scans <themesDir>/*.json, validates and registers valid user themes.
 * Missing/empty folder → empty result (no error). Invalid file or
 * collision with a built-in ID → skipped (reason logged).
 */
export async function scanUserThemes(themesDir: string): Promise<ScanResult> {
  const registered: string[] = [];
  const skipped: { file: string; reason: string }[] = [];
  // #396: duplicate user IDs within a scan must not silently
  // overwrite each other (last-wins). The first wins (files are sorted), further
  // ones are skipped + logged — consistent with skip-on-invalid.
  const seenIds = new Set<string>();

  let files: string[];
  try {
    files = (await readDir(themesDir))
      .filter((d) => d.isFile && d.name.endsWith('.json'))
      .map((d) => d.name)
      .sort();
  } catch {
    // AP-006: themes folder is missing or unreadable — empty result.
    return { registered, skipped };
  }

  for (const file of files) {
    const path = await join(themesDir, file);
    let text: string;
    try {
      text = await readTextFile(path);
    } catch {
      // AP-006: file unreadable — skip, keep loading the others.
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
