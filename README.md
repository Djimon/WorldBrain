# WorldBuilderX

![Status](https://img.shields.io/badge/Status-In%20Development-F5C542) ![Platform](https://img.shields.io/badge/Platform-Windows-5C5C5C) ![Stack](https://img.shields.io/badge/Stack-Tauri%20v2%20%7C%20React%20%7C%20TypeScript-2B90D9?logo=react&logoColor=white) ![License](https://img.shields.io/badge/License-Proprietary-red)

> A local-first desktop app for game masters and writers to build, organize, and run fictional worlds.

WorldBuilderX keeps your world data as plain JSON on disk — readable, portable, and git-friendly. You own your files. No cloud, no subscriptions, no lock-in.

---

## What it does

- **Build your world** — Create entities (characters, locations, factions, items, events) with a block-based editor and link them through a knowledge graph
- **Run your sessions** — Session play mode with GM whiteboard, dice panel, encounter tracker, and per-player visibility controls
- **Track time** — In-world calendar, event timeline, and world-state projections that update as your story progresses
- **Manage rules** — Plugin system with formula engine, character sheets, and house-rule overlays for any game system
- **Present and share** — Export cards, handouts, and session logs; fog-of-war maps; soundboard panel

---

## Getting started

WorldBuilderX runs on **Windows** (x64). Requires Node.js 24, Rust, and Tauri CLI v2.

```sh
npm ci
npm run desktop:dev     # start in dev mode
npm run desktop:build   # build a release .exe + installer
```

Full setup instructions: [DEVELOPMENT.md](DEVELOPMENT.md)

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
| M8 | Session play mode | ✅ Done |
| M9 | System plugin & character sheet | ✅ Done |
| M10 | Multiplayer & player identity | 🔄 In progress |
| M11 | Localization / i18n | ✅ Done |
| M12 | Resolution & resource layer | ✅ Done |
| M13 | House-rule overlays | 🔄 In progress |
| M14 | Calendar, events & world state | 🔄 In progress |
| M15 | Play & presentation tools | ⏳ Planned |

---

## License

Proprietary. All rights reserved.
