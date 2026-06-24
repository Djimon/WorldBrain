# WorldBuilderX — Claude Code Instructions

See `AGENTS.md` for all project rules, workflow, and engineering principles.

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
