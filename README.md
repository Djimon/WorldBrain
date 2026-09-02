# Worlds and Beyond

![Status](https://img.shields.io/badge/Status-0.1%20Beta%20(in%20prep)-F5C542) ![Platform](https://img.shields.io/badge/Platform-Windows-5C5C5C) ![Stack](https://img.shields.io/badge/Stack-Tauri%20v2%20%7C%20React%20%7C%20TypeScript-2B90D9?logo=react&logoColor=white) ![License](https://img.shields.io/badge/License-Proprietary-red)

> A local-first desktop app for game masters and writers to build, organize, and run fictional worlds — with full rules support, live session tools, and optional co-op multiplayer.

Worlds and Beyond keeps your world data as plain JSON on disk — readable, portable, and git-friendly. You own your files. No cloud, no subscriptions, no lock-in.

---

## What it does

- **Build your world** — Create entities (characters, locations, factions, items, events) with a block-based editor and link them through a knowledge graph with visual navigation
- **Run your sessions** — Session play mode with GM whiteboard, dice panel, encounter tracker, initiative order, and per-player visibility controls
- **Track time** — In-world calendar, event timeline, and world-state projections that update as your story progresses
- **Manage rules** — Plugin system with formula engine, character sheets, condition logic, and house-rule overlays for any game system
- **Present and share** — Export cards, handouts, and session logs; fog-of-war maps with canvas rendering; soundboard panel with clip editor
- **Play together** — Local network and remote WebRTC multiplayer (Trystero/Nostr, P2P end-to-end encrypted); player identity and invitation codes (M10, in progress)

---

## Current focus — 0.1 Beta

The first public build is a **0.1 Beta** centered on the core author-and-run loop.
Which features ship is set in [`features.json`](features.json); for 0.1 the active set is:

- **Edit mode** — entities · search · maps · calendar · audio · graph · settings
- **Play mode** — entities · search · maps · calendar · lobby · settings

Chronicle, cards, the plugin-manager UI, and the rules reference are built but switched
**off** for 0.1 and return in a later build — the plugin *substrate* that powers entity
types stays on. Everything under "What it does" above is the full product vision; the list
here is what the first Beta actually ships.

---

## Getting started

Worlds and Beyond runs on **Windows** (x64). Requires Node.js 24, Rust, and Tauri CLI v2.

```sh
npm ci
npm run desktop:dev     # start in dev mode
npm run desktop:build   # build a release .exe + installer
```

Full setup instructions: [DEVELOPMENT.md](DEVELOPMENT.md)

### Release feature toggles

Which in-development features ship in a release build is controlled by the flat
[`features.json`](features.json) at the repo root — one line per feature, `true` = ships,
`false` = removed. Editing is safe for non-developers: set a feature to `false` and the
next release build leaves its code out entirely (dev runs always show everything). The
current 0.1 values:

```json
{
  "chronicle": false, "cards": false, "plugins": false, "rules": false,
  "audio": true, "graph": true, "maps": true, "session": true
}
```

---

## Milestones

| Milestone | Scope | Status |
|---|---|---|
| M0 | Project foundation & app shell | ✅ Done |
| M1 | JSON ground truth & runtime database | ✅ Done |
| M2 | Entity editing MVP + Relations | ✅ Done |
| M3 | Search & knowledge views | ✅ Done |
| M4 | Session mode | ✅ Done |
| M5 | Maps & export | ✅ Done |
| M6 | Plugins & rulesets | ✅ Done |
| M7 | Packaging & operations | ✅ Done |
| MI | UI Integration Sprint | ✅ Done |
| M8 | Session play mode | ⚠️ Nearly done |
| M9 | System plugin & character sheet | ✅ Done |
| M10 | Multiplayer & player identity | 🔄 In progress |
| M11 | Localization / i18n | ✅ Done |
| M12 | Resolution & resource layer | ✅ Done |
| M13 | House-rule overlays | ✅ Done |
| M14 | Calendar, events & world state | ⚠️ Nearly done |
| M15 | Play & presentation tools | ✅ Done |
| M16 | Knowledge graph visualization | 🔄 In progress |

---

## License

Proprietary. All rights reserved.
