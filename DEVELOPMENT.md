# Development Setup

## Prerequisites

- Node.js `24.17.0` LTS and npm `11.13.0`
- Rust via rustup (`rustc`, `cargo`)
- Tauri CLI v2
- Windows only: Microsoft C++ Build Tools (Desktop development with C++) + Edge WebView2 Runtime

Verify:

```sh
node --version
npm --version
rustc --version
cargo --version
cargo tauri --version
```

Or via repo script: `npm run check:prerequisites`

## Install

```sh
npm ci
```

Never install Node/npm into the repo folder. Dependencies come from `npm ci` only.

## Windows PATH note

If PowerShell cannot find bare `npm`, use the fixed system paths:

```powershell
& 'C:\Program Files\nodejs\node.exe' --version
& 'C:\Program Files\nodejs\npm.cmd' --version
```

For npm scripts, prepend first:

```powershell
$env:PATH = 'C:\Program Files\nodejs;' + $env:PATH
npm run check
```

## Verification

```sh
npm run check        # full aggregate check (toolchain + prerequisites + test + build)
npm run test         # unit + DOM tests
npm run build        # TypeScript typecheck + Vite build
npm run desktop:build
npm audit --audit-level=high
```

## Agent Workflow

See `AGENTS.md` for the four-phase agent workflow (Requirement → TDD → Implementation → Review).
