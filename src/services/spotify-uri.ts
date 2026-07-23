// Crude Spotify tier (post-EPIC-024 addition, user-requested despite the
// epic's own spike confirming "not V1" — see audio-spotify-tauri-spike.md:
// the public embed has no setVolume at all, hard on/off only). Accepts
// either a canonical spotify: URI or an open.spotify.com URL and normalizes
// to the URI form the embed's createController expects.
export function parseSpotifyUri(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.startsWith('spotify:')) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (!url.hostname.endsWith('open.spotify.com')) return null;

  const [, type, id] = url.pathname.split('/');
  if (!type || !id) return null;
  return `spotify:${type}:${id}`;
}
