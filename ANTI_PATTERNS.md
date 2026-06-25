# Anti-Patterns

Patterns that caused Critical/Severe bugs across multiple EPICs — fixed, then reintroduced by a fresh agent.

Requirement Agent: copy AC fragment into every affected Story.
TDD Agent: write a test that fails if the pattern is present.
Implementation Agent: any instance is a blocker, not a style note.

---

## AP-001 — `database as never` (recurring since EPIC-003)

**Rule:** `database` prop must be typed as `DatabaseLike` (from `src/services/entity-service.ts`). No `unknown`, no `as never`, no local re-declaration.

**Why:** TypeScript accepts `never` silently — type errors at the service boundary are invisible.

**AC fragment:** "database prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites."

---

## AP-002 — TipTap extension as plain object (recurring since M2-S04)

**Rule:** All TipTap extensions must use `Node.create()`, `Mark.create()`, or `Extension.create()`. Plain objects are never extensions.

**Why:** TipTap never registers the node type — blocks silently disappear or corrupt documents.

**AC fragment:** "TipTap extension must be created with `Node.create()`; plain config objects are not valid extensions."

---

## AP-003 — `prompt()` / `alert()` for user interaction (recurring since M5-S02)

**Rule:** No `prompt()`, `alert()`, or `confirm()` in production code. Use React-rendered UI or the Tauri dialog API.

**Why:** Blocking browser-only APIs — in Tauri v2 they either do nothing or show an OS dialog. Untestable.

**AC fragment:** "No `prompt()`, `alert()`, or `confirm()` calls; all user input via rendered React UI or Tauri dialog API."

---

## AP-004 — Raw HTML interpolation of user data (first found E8-S09)

**Rule:** All user-supplied strings must be HTML-escaped before interpolation in exported HTML. Add a CSP meta tag.

**Why:** XSS. Exported files opened in a browser execute injected scripts with `file://` privileges.

**AC fragment:** "All user-supplied strings HTML-escaped before interpolation in exported HTML; CSP meta tag present in output."

---

## AP-005 — `require()` in ESM Vitest tests (recurring since M5-S02)

**Rule:** Never use `require()` in test files. Use ESM `import` / `await import()`. Node built-ins: `import { readFileSync } from 'node:fs'`.

**Why:** Vitest runs ESM — `require` throws `ReferenceError` at runtime, silently breaking every assertion in the file.

**AC fragment:** "Test file must use ESM `import` exclusively; no `require()` calls."

---

## AP-006 — Silent `try/catch` around DB operations (first found M5-S14)

**Rule:** No `try/catch` around `prepare`/`run`/`all`/`get`. Apply the schema before use — that is the guard. Errors propagate.

**Why:** Swallowed DB errors are indistinguishable from "no data". Bugs survive silently into production.

**Exceptions:** `JSON.parse` of external/DB data (return safe fallback) · filesystem I/O at load boundaries (return structured error) · FTS5→LIKE fallback by design (comment required).

**AC fragment:** "No `try/catch` around DB operations; errors propagate to the caller."
