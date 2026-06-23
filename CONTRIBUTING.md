# Contributing

## Development Policy

Use npm as the repository package manager.

The project is prepared as a root Node/npm workspace with `package.json` and
`package-lock.json`. The project targets Node.js `24.17.0` LTS and npm
`11.13.0`; `.node-version` and `package.json` are the source of truth.

Install Node.js `24.17.0` LTS with a normal developer toolchain such as the
official Node.js installer, winget, fnm, nvm-windows, Volta, or asdf. Then verify
the active shell:

```sh
npm run check:toolchain
```

On this Windows workspace, the correct system Node/npm installation may be
available even when `npm` is not on `PATH`. If a PowerShell session cannot find
bare `npm`, first verify the fixed system install:

```powershell
& 'C:\Program Files\nodejs\node.exe' --version
& 'C:\Program Files\nodejs\npm.cmd' --version
```

Those commands must report Node.js `24.17.0` and npm `11.13.0`. For npm
scripts, prepend the system Node directory to the current PowerShell `PATH`
before running normal npm commands:

```powershell
$env:PATH = 'C:\Program Files\nodejs;' + $env:PATH
npm run check:toolchain
```

Do not install Node.js or npm into repository folders. npm should come from the
developer toolchain, and project dependencies should come from `npm ci`.

Clean installs must use:

```sh
npm ci
```

The security gate is:

```sh
npm audit --audit-level=high
```

## Tauri Prerequisites

M0 uses Tauri v2 as the desktop wrapper path. pywebview is not used for the M0
implementation path.

Required local tools:

- Node.js `24.17.0` LTS and npm `11.13.0`.
- Rust installed through rustup, including `rustc` and `cargo`.
- Tauri CLI for the selected Tauri v2 path.
- On Windows: Microsoft C++ Build Tools with Desktop development with C++ / MSVC.
- On Windows: Microsoft Edge WebView2 Runtime.

Manual prerequisite check sequence:

```sh
node --version
npm --version
rustc --version
cargo --version
cargo tauri --version
```

Repository check command:

```sh
npm run check:prerequisites
```

Missing prerequisite handling is explicit: the check command fails on the first
missing required command and prints which prerequisite to install or repair. For
Rust failures, install rustup and ensure `rustc` and `cargo` are available. For
Tauri failures, install the Tauri CLI for the selected Tauri v2 path.

## Verification Workflow

Use this sequence before marking an M0 Story implementation verified:

```sh
npm run check:toolchain
npm run check:prerequisites
npm ci
npm run test
npm run build
npm run desktop:build
npm audit --audit-level=high
```

The aggregate local check is:

```sh
npm run check
```

`npm run build` is the current TypeScript typecheck gate because it runs
`tsc --noEmit` before the Vite build. Lint is not yet configured for M0.

Verification scripts:

- `npm run check`
- `npm run check:toolchain`
- `npm run check:prerequisites`
- `npm run test`
- `npm run build`
- `npm run desktop:dev`
- `npm run desktop:build`

Story work follows the project agent workflow:

- Requirement Agent: clarifies the Epic and splits it into small Stories.
- TDD Agent: writes the Story tests before production implementation.
- Implementation Agent: implements production code and must not edit Story
  tests.
- Review Agent: checks requirements, architecture, style, coverage, hidden
  assumptions, and scope.
