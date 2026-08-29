// M10-S11 (#367): appId-Ableitung für den Signaling-Broker-Namespace.
//
// Formel (Spike #380 + Memory `signaling-namespace-design`):
//   appId = sha256(appName + '\n' + majorMinor + '\n' + hostSecret) → hex(16)
//
// - `appName` = feste Konstante ("WorldBuilderX"), Rebrand = neuer Namespace.
// - `majorMinor` = z.B. "0.9" aus package.json, Minor-Bump = neuer Namespace.
// - `hostSecret` = einmal generierter Zufalls-Secret, persistiert.
//
// Warum überhaupt: öffentliche Nostr/BitTorrent-Relays sind für alle sichtbar;
// ohne unerratbaren Per-Host-Namespace könnte ein Fremder den Campaign-Namen
// raten und den Broker-Raum mitlesen. Der Secret macht den Namespace opak.
//
// Der Secret wird ausschließlich über `getHostSecret()` bezogen (Provider),
// damit V2 (mit Accounts) den Secret account-gehasht liefern kann → gleiche
// appId nach Hardware-Wechsel, alte Invites gelten weiter.

const STORAGE_KEY = 'wbrain.host-secret';
const APP_NAME = 'WorldBuilderX';

/**
 * Konzeptionelle Major-Minor-Version der App für den Broker-Namespace.
 * BEWUSST NICHT aus package.json abgeleitet: `package.json.version` (0.0.x)
 * ist der Build-Zähler und wird bei jedem Release inkrementiert — würde
 * darauf gehasht, wäre nach jedem Patch der Namespace neu und alle alten
 * Einladungen tot. Diese Konstante wird nur bei bewussten Namespace-Cuts
 * (inkompatible Netzwerk-Version) angefasst, nicht per Release-Automation.
 */
export const APP_MAJOR_MINOR = '0.9';

export interface DeriveAppIdOpts {
  appName: string;
  majorMinor: string;
  hostSecret: string;
}

/**
 * Deterministisch aus (appName, majorMinor, hostSecret) einen 16-hex-Zeichen
 * Namespace ableiten. Gleiche Inputs → gleicher Output. Verschiedene
 * hostSecrets → verschiedene Outputs.
 */
export async function deriveAppId(opts: DeriveAppIdOpts): Promise<string> {
  const input = `${opts.appName}\n${opts.majorMinor}\n${opts.hostSecret}`;
  const bytes = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  // 16 Zeichen (64 Bit) reichen kollisions-sicher fürs Namespacing und halten
  // den Invite-Link kurz.
  return hex.slice(0, 16);
}

/**
 * Host-Secret-Provider — V1: read-or-generate aus localStorage. V2 wird ihn
 * per Account liefern (siehe Memory). Aufrufer nutzen ausschließlich diese
 * Funktion, nie den Storage direkt.
 */
export async function getHostSecret(): Promise<string> {
  const existing = readStoredSecret();
  if (existing !== null && existing.length > 0) return existing;
  const generated = generateSecret();
  writeStoredSecret(generated);
  return generated;
}

function readStoredSecret(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function writeStoredSecret(value: string): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, value); } catch { /* fail-open */ }
}

function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convenience: für den aktuellen Host die appId mit den kanonischen
 * Konstanten (APP_NAME + APP_MAJOR_MINOR) + persistiertem Host-Secret
 * ableiten. Diese Funktion ist die EINZIGE Stelle wo Aufrufer die appId
 * bekommen sollen — kein manuelles majorMinor-Übergeben mehr (verhindert
 * Desync zwischen Aufruferstellen).
 */
export async function currentAppId(): Promise<string> {
  const secret = await getHostSecret();
  return deriveAppId({ appName: APP_NAME, majorMinor: APP_MAJOR_MINOR, hostSecret: secret });
}
