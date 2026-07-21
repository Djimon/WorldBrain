# EPIC-024: Audio Soundboard Panel

Milestone: **M15 - Play & Presentation Tools** (GitHub #18). Area: `area: audio` (new).
Greenfield — no existing audio substrate. Detached DM soundboard, Streamdeck-style.

## Goal

A detachable soundboard the DM runs on a second monitor: channels of quick-access audio
buttons, mixed live. Local files get a full mixer (volume / balance / 3-band EQ / crossfade);
YouTube links get a Djinni-parity linked-player tier (volume / fade / loop / mix). Boards are
saved as Scenes and switched per situation.

## Inspiration & prior art

Djinni Music Player (Owlbear extension, `kgbergman/djinni-music-player`, verified 2026-07-11):
React + `react-youtube` / `react-player` + `zustand` + `emoji-mart` + `react-colorful` +
`can-autoplay`. YouTube plays via hidden IFrame players (volume + fade + loop + multi-mix).
Folders (colored, named) = scenes. GM broadcasts via the Owlbear SDK. Notably it does **not**
attempt EQ / balance / crossfade on YouTube — the IFrame API cannot. We confirm that ceiling.

## Scope

- Detached soundboard window (Tauri WebviewWindow, own AudioContext, shared SQLite DB).
- Channels (up to 8), each with a shared volume fader + mute; local channels also balance + 3-band EQ.
- Per-channel **mode**: `replace` (one clip at a time, auto cut/fade to the new) or `add` (each clip toggled on/off independently, layered ambience).
- Per-channel transition config: cut vs fade, with seconds. `replace` mode = auto crossover to the new clip; `add` mode = each clip's on/off cut/fade.
- Audio buttons (clips): one source = local file OR one link. Per-clip **base volume** (pre-set so layers balance), emoji icon + label + background color.
- Local audio engine: Web Audio channel strip (gain → balance → 3-band EQ → master), play/stop/fade/loop, true crossfade.
- YouTube tier: `react-player` / `react-youtube` IFrame players — volume / fade / loop / mix; balance + EQ disabled; coarse volume-ramp crossfade. A playlist link = one "track" (not decomposed).
- Scenes: named full-board snapshots (channels + their clips + mixer settings); save / load / switch.
- Preset (clip) editor: assign source, base volume, icon / color / label, loop.
- Autoplay gate overlay (browser/WebView autoplay policy).

## Out Of Scope

- Player-facing broadcast / network sync. V1 = DM output only (table speakers, or DM routes system audio into TeamSpeak/Discord — the OS handles that, we build no networking). LAN broadcast is a future tie-in to M10 (#195–204).
- EQ / balance on YouTube/Spotify sources (cross-origin IFrame = no Web Audio node — hard browser boundary; see Decisions).
- Downloading / re-hosting YouTube audio (violates YouTube ToS — never build).
- System/tab audio loopback capture for a master-EQ-over-everything (native, fragile, out of scope).
- Spotify tier (OAuth + Premium + DRM + zero signal access) — not V1; revisit after YouTube tier proves out.
- Beat/tempo sync, waveform editing, recording, DSP effects beyond the 3-band EQ.

## Decisions

- **D1 — Detached window, own AudioContext.** The soundboard is a Tauri `WebviewWindow` with its own
  webview + `AudioContext`, so moving/minimizing the builder never interrupts audio. It reads/writes the
  **same SQLite DB** for Scenes/channels/clips. Audio is hosted in this window (survives builder re-renders).
- **D2 — Two source tiers, honest per-source controls.**
  - **Local file** → Web Audio channel strip: full volume / balance / 3-band EQ / true crossfade.
  - **YouTube link** → IFrame player (`react-player`/`react-youtube`): volume / fade / loop / mix / coarse crossfade;
    **balance + EQ controls disabled** on the clip/channel when a YouTube source is active.
  - Rationale: a cross-origin YouTube IFrame exposes no Web Audio node (`MediaElementSource` needs same-origin).
    Per-channel EQ on YouTube is impossible within scope/ToS — this is a hard boundary, documented so no
    future agent re-litigates it.
- **D3 — Channel mode = `replace` | `add`.**
  - `replace`: clicking a clip plays it and auto-stops the previous per the channel's transition (cut/fade seconds). Exclusive.
  - `add`: each clip toggles on/off independently (cut/fade per the channel setting); multiple clips layer simultaneously.
- **D4 — Per-clip base volume; one shared channel fader.** Each clip has a pre-set `base_volume` so layers
  balance (rain vs wind). The channel fader (+ balance/EQ for local) scales all its clips together.
- **D5 — A link (incl. a playlist URL) is ONE clip/track.** The system does not decompose playlists; one button = one source.
- **D6 — 3-band EQ scale.** Bass/mid/high as Biquad filters (lowshelf/peaking/highshelf), user range ±12 dB, centre = flat. (UI wording TBD in S06; internal is dB.)
- **D7 — Scene = full-board snapshot.** A Scene stores all channels, their clips, and mixer settings. Switching a Scene swaps the whole board. Config persists; live playback state is transient runtime.
- **D8 — YouTube-in-Tauri: Risiko GEKLÄRT, Spike #280 abgeschlossen → GO.** Ursprüngliche Sorge: Djinni läuft
  auf einer echten https-Origin in Owlbear, unsere Tauri-WebView (`tauri://`/localhost) könnte an
  IFrame-Embedding-/Referrer-/Autoplay-Restriktionen scheitern. **Verifiziert in echtem WebView2 (UA `Edg/150`),
  Reports in `planning/research/`:**
  - `audio-youtube-tauri-spike.md`: IFrame-API lädt und spielt, **keine** Referrer-/Origin-/CSP-Fehler,
    saubere Play/Pause-States. **Unmuted Autoplay gelingt OHNE User-Geste** → für den Link-Tier ist
    **kein Autoplay-Overlay / kein `can-autoplay`** nötig.
  - `audio-hidden-playback-tauri-spike.md`: Wiedergabe läuft bei `display:none`, `visibility:hidden` und
    Off-screen ununterbrochen weiter. **`display:none` ist die empfohlene Hide-Variante.**
  - `audio-spotify-tauri-spike.md`: bestätigt Spotify-nicht-V1 **technisch** — das öffentliche Embed hat
    `controller.setVolume === undefined`, also nicht mal Volume/Fade. Nur hart an/aus.
  - **Noch offen, bei S13-Umsetzung mitverifizieren (kein zweiter Spike):** `setVolume`-Rampe (Fade-Basis)
    und Playlist-als-eine-durchgehende-Quelle (`loadPlaylist`) wurden im Spike nicht bestätigt.
  - **CSP:** aktuell `"csp": null` → keine Anpassung nötig. Wird später eine CSP eingezogen, müssen
    `frame-src`/`connect-src` youtube.com / youtube-nocookie.com / ytimg.com erlauben.
  - **Abgrenzung Autoplay:** Der Befund gilt für **IFrame-/Media-Autoplay**. Der `AudioContext` des lokalen
    Web-Audio-Tiers (S12) ist ein **anderer** Mechanismus und wurde NICHT getestet — bei S10/S12 prüfen, ob
    er `running` oder `suspended` startet; nur bei `suspended` ein Resume-Gate bauen.

## Data model (pinned for S03)

- `audio_scenes`: `id`, `name`, `order`, `created_at`.
- `audio_channels`: `id`, `scene_id`, `name`, `order`, `mode` (`replace`|`add`), `volume` REAL 0–1,
  `balance` REAL -1..1, `eq_low` / `eq_mid` / `eq_high` REAL dB, `transition_type` (`cut`|`fade`), `transition_seconds` REAL, `muted` INTEGER.
- `audio_presets` (clips/buttons): `id`, `channel_id`, `order`, `source_type` (`file`|`link`), `source_ref` (path or URL),
  `base_volume` REAL 0–1, `label`, `icon` (emoji), `color`, `loop` INTEGER, `created_at`.

## Stories

| Story | Issue | Type | Prio | Kern |
|---|---|---|---|---|
| M15-S09  | #280 | spike | p0 | YouTube IFrame in Tauri WebView: load + volume-ramp + autoplay gate feasibility |
| M15-S10 | #281 | story | p1 | Detached soundboard window (Tauri WebviewWindow, own AudioContext, shared DB, autoplay overlay) |
| M15-S11 | #282 | story | p1 | Audio data model + service (`audio_scenes`/`audio_channels`/`audio_presets`) |
| M15-S12 | #283 | story | p1 | Local audio engine: channel strip (gain→balance→3-band EQ→master), play/stop/fade/loop, crossfade |
| M15-S13 | #284 | story | p1 | YouTube tier: IFrame players per channel — volume/fade/loop/mix; balance/EQ off; coarse crossfade |
| M15-S14 | #285 | story | p1 | Board UI: channels as rows, 8 clip buttons (emoji+label+color), volume+dB, mute, mode + transition config |
| M15-S15 | #286 | story | p1 | Scenes: save/load/switch full-board snapshots |
| M15-S16 | #287 | story | p1 | Clip editor: source (file/link), base volume, icon/color/label, loop |

**Dependency axis:** ~~S09 (spike) gates S13~~ → **S09 (#280) abgeschlossen 2026-07, GO; S13 (#284) dadurch
entsperrt und auf `status: ready`.** S10 (window) + S11 (model) foundational. S12 needs S11.
S13 needs S11. S14 needs S10+S11+S12. S15/S16 need S11+S14.

Note: story numbers continue M15's sequence (S01–S08 belong to EPIC-023 maps); these are S09–S16.

## Constraints propagated into every Story AC (verbatim)

- AP-001: `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts.
- AP-006: No `try/catch` around DB operations; errors propagate. (Exception: `JSON.parse` of stored config → safe fallback.)
- AP-008 (service gate): No `if (database)`/`if (service)` guard before service calls; optional props passed through.
- UI stories: AP-003 (no `prompt`/`alert`/`confirm`); AP-008 RTL (anchored queries); no hardcoded UI strings (`useTranslation` + inline German default); ≥1 `.dom.test.tsx` covering interactive elements.
- Test files: ESM `import` only, no `require()` (AP-005).

## Open Decisions

- None blocking. (Spotify tier, LAN broadcast, master-EQ-loopback all explicitly deferred/out.)

## Sources

- Djinni Music Player: `github.com/kgbergman/djinni-music-player`, `extensions.owlbear.rodeo/djinni-music-player`.
- Concept screenshot: `_design/soundboard concept.png` (channel rows, emoji+label+color tiles, volume + dB, mute).
- Interview 2026-07-11 (Requirement Agent).
