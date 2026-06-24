# WorldBuilderX — Claude Code Instructions

See `AGENTS.md` for all project rules, workflow, and engineering principles.

## Windows Toolchain

See `DEVELOPMENT.md` for full setup instructions and verification scripts.


`npm` may be absent from PATH. Fixed paths:
- `C:\Program Files\nodejs\node.exe`
- `C:\Program Files\nodejs\npm.cmd`

Before npm scripts: `$env:PATH = 'C:\Program Files\nodejs;' + $env:PATH`

Expected: Node `24.17.0`, npm `11.13.0`. Wrong versions → `BLOCKED`.


## Shell & Tool Usage

**Niemals komplexe PowerShell-Scriptblöcke verwenden.** Keine verschachtelten `$`-Variablen, Pipes oder `ForEach-Object`-Konstrukte in einem einzigen Befehl — diese triggern manuelle Freigaben.

Stattdessen immer direkte CLI-Befehle nutzen:

**Falsch:**
```powershell
$issues = gh issue list --json number,title | ConvertFrom-Json | Where-Object { ... } | ForEach-Object { ... }
```

**Richtig:**
```bash
gh api repos/Djimon/WorldBrain/issues --jq '.[] | select(.number >= 67)'
```
