// M10-S11 (#367): appId derivation for the signaling-broker namespace.
//
// Formula (Spike #380 + Memory `signaling-namespace-design`):
//   appId = sha256(appName + '\n' + majorMinor + '\n' + hostSecret) → hex(16)
//
// - `appName` = fixed constant ("WorldBuilderX"), rebrand = new namespace.
// - `majorMinor` = e.g. "0.9" from package.json, minor bump = new namespace.
// - `hostSecret` = randomly generated secret, generated once and persisted.
//
// Why at all: public Nostr/BitTorrent relays are visible to everyone;
// without an unguessable per-host namespace a stranger could guess the campaign
// name and eavesdrop on the broker room. The secret makes the namespace opaque.
//
// The secret is obtained exclusively via `getHostSecret()` (provider), so that
// V2 (with accounts) can deliver the secret account-hashed → same
// appId after a hardware change, old invites remain valid.

const STORAGE_KEY = 'wbrain.host-secret';
const APP_NAME = 'WorldBuilderX';

/**
 * Conceptual major-minor version of the app for the broker namespace.
 * DELIBERATELY NOT derived from package.json: `package.json.version` (0.0.x)
 * is the build counter and is incremented on every release — if we hashed
 * on it, the namespace would be new after every patch and all old
 * invitations would be dead. This constant is only touched on deliberate
 * namespace cuts (incompatible network version), not by release automation.
 */
export const APP_MAJOR_MINOR = '0.9';

export interface DeriveAppIdOpts {
  appName: string;
  majorMinor: string;
  hostSecret: string;
}

/**
 * Deterministically derive a 16-hex-character namespace from
 * (appName, majorMinor, hostSecret). Same inputs → same output. Different
 * hostSecrets → different outputs.
 */
export async function deriveAppId(opts: DeriveAppIdOpts): Promise<string> {
  const input = `${opts.appName}\n${opts.majorMinor}\n${opts.hostSecret}`;
  const bytes = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  // 16 characters (64 bit) are collision-safe enough for namespacing and keep
  // the invite link short.
  return hex.slice(0, 16);
}

/**
 * Host-secret provider — V1: read-or-generate from localStorage. V2 will
 * deliver it per account (see Memory). Callers use exclusively this
 * function, never the storage directly.
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
 * Convenience: derive the appId for the current host from the canonical
 * constants (APP_NAME + APP_MAJOR_MINOR) + persisted host secret.
 * This function is the ONLY place where callers should get the appId
 * — no more manual majorMinor passing (prevents desync between call
 * sites).
 */
export async function currentAppId(): Promise<string> {
  const secret = await getHostSecret();
  return deriveAppId({ appName: APP_NAME, majorMinor: APP_MAJOR_MINOR, hostSecret: secret });
}
