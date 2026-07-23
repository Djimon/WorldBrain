// M15-S13 (#284): extracts a video/playlist id from a YouTube URL. A
// playlist URL is ONE clip (D5) — never decomposed into its member videos.
export interface YoutubeSource {
  videoId: string | null;
  playlistId: string | null;
}

export function parseYoutubeSource(url: string): YoutubeSource {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { videoId: null, playlistId: null };
  }

  const playlistId = parsed.searchParams.get('list');

  if (parsed.hostname === 'youtu.be') {
    const videoId = parsed.pathname.slice(1) || null;
    return { videoId, playlistId };
  }

  const videoId = parsed.searchParams.get('v');
  return { videoId, playlistId };
}
