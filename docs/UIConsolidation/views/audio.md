# Audio / Soundboard View — UI Consolidation Audit

Scope: `src/ui/AudioSoundboardWindow.tsx`, `SoundboardBoard.tsx`, `ChannelRow.tsx`,
`ClipButton.tsx`, `ClipEditor.tsx`, `SpotifyChannelPlayers.tsx`, `SpotifyClipPlayer.tsx`,
`YoutubeChannelPlayers.tsx`, `YoutubeClipPlayer.tsx`.

CSS lives in `src/style.css` under the `/* ── Audio Soundboard (EPIC-024, M15-S10..S16) ─────────── */`
block (line 3814 onward), plus one earlier stray rule (line 191). None of these components
import a co-located `.css` file — everything goes through the global `style.css`, except the
color-value inline styles noted below.

## A. Component inventory

| Component (file:line) | Role/purpose | Generic or view-specific? | Reused elsewhere? (where) | Key CSS classes | Local or shared classes? | Hardcoded colors |
|---|---|---|---|---|---|---|
| `AudioSoundboardWindow` (`src/ui/AudioSoundboardWindow.tsx:33`) | Root of the detached soundboard webview window — DB/AudioContext bootstrap, loading/no-project/autoplay-gate states, mounts `ReadyBoard` | View-specific (window root) | No — only imported by `src/main.tsx` as the webview's entry | `.audio-soundboard-window`, `.audio-soundboard-window__gate`, `.btn.btn--primary` (gate button, line 86) | `.audio-soundboard-window` shared/local to this view only (defined twice, see §C); `.btn`/`.btn--primary` are the app-wide generic button classes (`style.css:474`) | none in this file |
| `ReadyBoard` (`src/ui/AudioSoundboardWindow.tsx:110`) | Inner component: owns the 3 playback engines (local/YouTube/Spotify), scene switching, clip-editor modal state | View-specific | No | `.audio-soundboard-window` (reuses parent's class) | shared (same class as above) | none |
| `SoundboardBoard` (`src/ui/SoundboardBoard.tsx:48`) | The channel list ("Streamdeck-style board") — loads the active scene, wires clip triggers/mixer changes to the 3 engines, renders one row + hidden players per channel | View-specific | No — only imported by `AudioSoundboardWindow.tsx` | `.soundboard-board`, `.soundboard-board__channel`, `.soundboard-board__error`, `.soundboard-board__error-dismiss`, `.soundboard-board__add-channel`, `.btn` (add-channel, line 237) | Local classes (`soundboard-board*` only defined/used here); `.btn` shared generic | none |
| `ChannelRow` (`src/ui/ChannelRow.tsx:49`) | One channel: play/pause+waveform, name+mode/transition chips, up to 8 `ClipButton`s, volume/mute/settings, expandable Balance+EQ popover, expandable name/mode/transition settings popover | Generic **shape** (a reusable "list row with controls + expandable popovers" pattern) but wired entirely to audio-specific data — currently view-specific in practice | No — only imported by `SoundboardBoard.tsx` | `.channel-row`, `.channel-row__status`, `__status-icon`, `__waveform`, `__bar`, `__name-block`, `__name`, `__chips`, `__chip`, `__clips`, `__mixer`, `__mixer-toggle`, `__balance`, `__volume`, `__db`, `__mute`, `__settings-btn`, `__settings-popover`, plus generic `.btn` (close buttons, lines 184, 219) | All `channel-row__*` classes are local to this file (`style.css:4013-4225`), single-consumer | `#fff` at `style.css:4052`, `4150`, `4193` (aria-pressed/expanded active-state foreground) |
| `ClipButton` (`src/ui/ClipButton.tsx:18`) | One Streamdeck tile: colored trigger button + separate sibling edit button; empty-slot variant renders a dashed "+" | Generic **shape** (icon+label+color tile) but data-typed to `AudioPresetRow` — not reusable as-is | No — only imported by `ChannelRow.tsx` | `.clip-button-wrap`, `.clip-button`, `.clip-button--empty`, `__icon`, `__label`, `.clip-button__edit` | Local (`style.css:4229-4299`), single-consumer | `DEFAULT_CLIP_COLOR = '#3a3f45'` (`ClipButton.tsx:9`, also used inline at `:40` via `style={{ backgroundColor: preset.color ?? DEFAULT_CLIP_COLOR }}`); CSS: `#fff` at `style.css:4243` (`.clip-button` base text color) |
| `ClipEditor` (`src/ui/ClipEditor.tsx:29`) | Modal-ish fixed-position dialog: source type (file/YouTube link/Spotify URI), label, base volume, icon (via `EmojiPicker`/`EmojiPickerHost`), color swatches, loop, save/cancel/delete-with-confirm | View-specific | No — only imported by `AudioSoundboardWindow.tsx` | `.clip-editor`, `__source-file`, `__source-path`, `__color-picker`, `__color-swatch`, `__icon-field`, `__icon-trigger`, `__icon-popover`, `__actions`, plus generic `.btn`/`.btn--primary` (lines 127-235) | Local (`style.css:4303-4420`), single-consumer | `DEFAULT_CLIP_COLOR = '#3a3f45'` (`ClipEditor.tsx:16`, duplicate of `ClipButton.tsx:9`); `COLOR_CHOICES` array of 6 hex values (`ClipEditor.tsx:18`): `#7b1d1d`, `#1d5f7b`, `#3c6f3c`, `#7b5f1d`, `#5f1d7b`, `#3a3f45` — used inline at `:214` via `style={{ backgroundColor: swatch }}`; CSS: `rgba(0, 0, 0, 0.4)` box-shadow at `style.css:4397` |
| `SpotifyChannelPlayers` (`src/ui/SpotifyChannelPlayers.tsx:12`) | Subscribes to `SpotifyTierEngine` slots for one channel, renders one hidden `SpotifyClipPlayer` per active slot | View-specific, structural **twin** of `YoutubeChannelPlayers` | No — only imported by `SoundboardBoard.tsx` | none (renders only children, a `<>` fragment) | n/a — zero CSS footprint | none |
| `YoutubeChannelPlayers` (`src/ui/YoutubeChannelPlayers.tsx:15`) | Subscribes to `YoutubeTierEngine` slots for one channel, renders one hidden `YoutubeClipPlayer` per active slot | View-specific, structural **twin** of `SpotifyChannelPlayers` | No — only imported by `SoundboardBoard.tsx` | none | n/a — zero CSS footprint | none |
| `SpotifyClipPlayer` (`src/ui/SpotifyClipPlayer.tsx:15`) | Mounts a hidden Spotify iframe embed controller for one clip; mount=play/unmount=pause; no volume access (D2-equivalent, crude tier) | View-specific, structural **twin** of `YoutubeClipPlayer` | No — only imported by `SpotifyChannelPlayers.tsx` | none — root is `<div ref={containerRef} style={{ display: 'none' }} />` (line 84), **no className at all** | n/a — pure inline style, no CSS class | inline style has no color, but the `display:'none'` literal is duplicated verbatim in `YoutubeClipPlayer.tsx:119` |
| `YoutubeClipPlayer` (`src/ui/YoutubeClipPlayer.tsx:21`) | Mounts a hidden YouTube IFrame player for one clip; supports volume ramping (`targetVolume`/`rampSeconds`) and loop, unlike Spotify | View-specific, structural **twin** of `SpotifyClipPlayer` | No — only imported by `YoutubeChannelPlayers.tsx` | none — root is `<div ref={containerRef} style={{ display: 'none' }} />` (line 119), **no className at all** | n/a — pure inline style, no CSS class | none |

## B. Duplication & similarity findings

### B1. Spotify vs YouTube twin pairs — THE major finding

**`SpotifyChannelPlayers` vs `YoutubeChannelPlayers`** (28 vs 40 lines): structurally identical.
Both: `useState` seeded from `engine.getSlots(channelId)`, a `useEffect` that re-syncs on mount
and subscribes to `engine.subscribe((changedChannelId, nextSlots) => …)` filtered by
`channelId`, and a `<>{slots.map(slot => <XClipPlayer key={slot.clipId} … />)}</>` render. The
*only* difference is the prop set forwarded per slot (Spotify: `uri`, `paused`; YouTube:
`videoUrl`, `targetVolume`, `rampSeconds`, `loop`, `paused`) — a direct consequence of the two
engines' slot shapes, not of the component logic. Zero CSS involved either side.

**`SpotifyClipPlayer` vs `YoutubeClipPlayer`** (85 vs 120 lines): same skeleton —
`containerRef` + a manually-created/appended `mountPoint` div (both files have the *identical*
comment explaining why: the 3rd-party SDK takes over the given element, so a React-owned node
can't be handed to it directly, or `removeChild` throws), an async `load<X>IframeApi()` call
gated by a `cancelled` flag, a `pausedRef` mirror read by the ready callback (both have near-
identical comments on why), a real pause/resume `useEffect` keyed on `paused` that calls the
controller's `pause()`/`play()`, and cleanup that pauses + nulls the ref + removes the
mountPoint. Root render is byte-for-byt identical: `<div ref={containerRef} style={{ display:
'none' }} />` (`SpotifyClipPlayer.tsx:84`, `YoutubeClipPlayer.tsx:119`).

Real (non-cosmetic) differences: YouTube supports volume ramping (`RAMP_STEPS_PER_SECOND`,
a `setInterval`-driven ramp loop, lines 82-109) and `loop` via `onStateChange`; Spotify has
**no** volume/signal access at all (per the file's own comment, "no volume/fade props exist,
none possible") and has an extra `forceEagerLoad()` hack to defeat the SDK's `loading="lazy"`
iframe inside a permanently `display:none` container (`SpotifyClipPlayer.tsx:43-46`) that
YouTube's `YT.Player` doesn't need.

**Verdict**: these are the same UI (a headless, invisible, provider-driven audio slot mounter)
with a different provider SDK underneath — but there is **no CSS duplication to consolidate**
here (neither pair uses a single className anywhere; both are pure `display:none` divs). The
duplication is 100% in **component/hook logic** (mount-point indirection, cancelled-flag
pattern, pausedRef pattern, cleanup shape), not in styling. A shared base (e.g. a
`useHiddenIframeEmbed` hook or a generic `<HiddenSlotPlayer>` wrapper that takes a
`load()`/`play()`/`pause()` adapter) could fold ~60-70% of both pairs together, but the
volume-ramp/loop logic is YouTube-only and the `forceEagerLoad` hack is Spotify-only, so full
merging is a **structural** change (needs a variant/adapter interface), not a drop-in.

### B2. `ClipButton` vs generic button (`.btn` / `<Button>` primitive)

`ClipButton` (`src/ui/ClipButton.tsx`) does **not** use `.btn` or the `<Button>` primitive at
all — it hand-rolls two fully custom classes (`.clip-button`, `.clip-button--empty`,
`style.css:4231-4275`) because it needs a dynamic background color per preset
(`style={{ backgroundColor: preset.color ?? DEFAULT_CLIP_COLOR }}`, line 40) and a fixed
68×56px tile size the generic `.btn`/`.ui-button` don't support. This is a legitimate
"needs-variant" case, not pure duplication — but it does mean the tile button and the edit
"pencil" button (`.clip-button__edit`) reinvent hover/active states (`transform`,
`box-shadow`, `opacity`) that `.ui-button`/`.btn` already standardize elsewhere. Not a
drop-in replacement candidate; a `<Button>` size/color-override variant could work.

### B3. `ChannelRow` as a reusable list-row pattern

`ChannelRow` (`src/ui/ChannelRow.tsx`) matches the "list row with active/hover state +
expandable inline popover" pattern called out in the shared reference (§3: `.emd__item`,
`.gsearch__result`, `.map-token-list__row`, `.map-pin-tree__group-header`) — specifically its
two `channel-row__settings-popover` blocks (mixer popover, name/mode/transition popover,
`ChannelRow.tsx:158-223`) duplicate the "panel/card shell" pattern (`.new-project__card`,
`.cal-section`, `.token-editor`) with its own one-off `channel-row__settings-popover` class
(`style.css:4196-4225`) instead of `<Panel>`/`.ui-panel`. However, `ChannelRow` is **not**
currently reused anywhere (only consumer is `SoundboardBoard.tsx:224`) — it is a candidate
*shape* for the future shared "list row" primitive, not an existing duplication to fix today.

### B4. `.btn` vs `<Button>`/`.ui-button` primitive (cross-view pattern, present here too)

`AudioSoundboardWindow.tsx:86`, `SoundboardBoard.tsx:237`, `ChannelRow.tsx:184,219`, and
`ClipEditor.tsx:127,130,151,228,231,235` all use the hand-rolled `.btn`/`.btn--primary`
classes (`style.css:474-515`) instead of the `<Button tone>` primitive
(`src/ui/primitives.tsx:46`, `.ui-button`). `.btn` and `.ui-button` are near-identical in
intent (border/radius/surface bg, `--primary`/`data-tone='accent'` variant) — this view is
one more data point for the shared-reference's existing "Button" consolidation row (§2 table),
not a new finding, but every audio-view button is affected.

### B5. Duplicated `DEFAULT_CLIP_COLOR` constant

`const DEFAULT_CLIP_COLOR = '#3a3f45';` is defined independently in both
`ClipButton.tsx:9` and `ClipEditor.tsx:16` — same literal value, same name, two files. Trivial
drop-in fix (hoist to a shared constant/module), flagged here because it's exactly the kind of
copy-paste the consolidation effort is meant to catch.

## C. CSS hygiene

- **Duplicate selector `.audio-soundboard-window`**: defined twice — `style.css:191`
  (`padding: var(--space-4); color: var(--color-text);`) and `style.css:3818`
  (`height: 100%; overflow-y: auto;`). Not conflicting (disjoint properties), but split across
  two unrelated locations in the file (one right after `.workspace-shell__sidebar-spacer`, one
  in the dedicated Audio Soundboard block) — should be merged into one rule in the Audio block.
- **Hardcoded `#fff` instead of a token**: `style.css:4052` (`.channel-row__status-icon[aria-pressed='true']`),
  `4150` (`.channel-row__mixer-toggle[aria-expanded='true']`), `4193` (`.channel-row__mute[aria-pressed='true']`),
  `4243` (`.clip-button` base). Matches the shared reference's noted missing "white-on-accent
  foreground" token (§1) — all four are the accent-background active-state text color.
- **Hardcoded `rgba(0, 0, 0, 0.4)`**: `style.css:4397` (`.clip-editor__icon-popover` box-shadow).
  Not the `rgba(0,0,0,0.6)` scrim value called out in the shared reference as a known-missing
  token, but the same category of "recurring un-tokenized shadow/overlay alpha."
- **Hardcoded hex in TSX (not CSS, so invisible to a CSS token audit)**: `ClipButton.tsx:9,40`,
  `ClipEditor.tsx:16,18,214` — 7 distinct hex literals (`#3a3f45` ×2 duplicated, plus the 6-value
  `COLOR_CHOICES` palette). One of the 6 palette choices, `#7b1d1d`, is coincidentally identical
  to `--color-accent`'s light-mode value (`tokens.css:5`) but is not written as a token
  reference, so it will silently diverge from the accent color under any future re-theme.
  This is a deliberate user-facing color *picker* (clip tiles need to stay visually distinct
  regardless of theme), so tokenizing may not be appropriate — but it should at minimum move
  out of two separate component files into one shared palette module.
- **No `!important` usage** found in the audio soundboard CSS block.
- **Magic numbers not tokenized**: clip tile size `68px`×`56px` (`style.css:4237-4238,4265-4266`),
  icon-button sizes `40px`/`32px`/`26px` (`4032-4033`, `4131-4132`, `3875-3876`), range widths
  `90px`/`110px` (`4168-4169`), popover/editor widths `220px`/`360px` (`4427`, `4311`),
  `z-index: 20` / `30` (clip-editor, icon-popover) — none derive from the token set's spacing
  scale (`--space-1..4`) or the "missing tokens" list (`--space-5`, larger radii).
- **One-off classes used exactly once** (single occurrence in both `style.css` and their
  consuming component — not necessarily a defect, just noted per report format): every
  `channel-row__*`, `clip-button*`, and `clip-editor__*` class, since none of these components
  are reused elsewhere (see §A "Reused elsewhere?" column — all "No").
- **Dead/orphaned classes**: none found — every class defined in the Audio Soundboard CSS block
  has a matching `className=` usage in the 9 scoped `.tsx` files (cross-checked via grep).

## D. Top 3 consolidation opportunities for this view (ranked)

1. **Extract a shared "hidden provider-embed player" base for Spotify/YouTube** (`SpotifyClipPlayer.tsx`
   + `YoutubeClipPlayer.tsx`, and by extension `SpotifyChannelPlayers.tsx` + `YoutubeChannelPlayers.tsx`).
   Biggest logic-duplication in the view (~70% of both `ClipPlayer` files is the identical
   mount-point/cancelled-flag/pausedRef/cleanup skeleton). No CSS involved (both are bare
   `display:none` divs), so this is a **structural** JS/hook refactor, not a CSS consolidation —
   effort: **medium-high** (needs an adapter interface to keep YouTube's volume-ramp/loop and
   Spotify's `forceEagerLoad` hack as pluggable extras, plus test coverage for both tiers).

2. **Migrate all `.btn`/`.btn--primary` usages in this view to `<Button tone>` / `.ui-button`**
   (`AudioSoundboardWindow.tsx:86`, `SoundboardBoard.tsx:237`, `ChannelRow.tsx:184,219`,
   `ClipEditor.tsx:127,130,151,228,231,235`). The classes are already near-identical in
   properties (`style.css:474-515` vs `primitives.css:1-24`) — effort: **drop-in** for the
   plain/`--primary` cases (`tone='neutral'|'accent'`), no danger variant exists in the
   primitive yet so `.btn--danger` callers elsewhere would need one first (none in this view
   actually use `--danger`, so audio itself is unblocked).

3. **Hoist `DEFAULT_CLIP_COLOR` and `COLOR_CHOICES` into one shared module** consumed by both
   `ClipButton.tsx` and `ClipEditor.tsx`, removing the duplicated `'#3a3f45'` literal — effort:
   **drop-in** (single constant extraction, no visual change).

Not ranked but worth a follow-up ticket: merge the two `.audio-soundboard-window` rule blocks
(`style.css:191` and `:3818`) into one, and replace the four `#fff` active-state literals with
whatever the shared reference's planned "white-on-accent foreground" token ends up being named.
