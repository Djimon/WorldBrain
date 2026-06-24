# Anti-Patterns

Patterns that have caused Critical or Severe bugs across multiple EPICs.
Each one was fixed, then reintroduced in a later Epic by a fresh agent.

Requirement Agent: copy the relevant constraint into every affected Story's acceptance criteria.
TDD Agent: write a test that fails if the pattern is present.
Implementation Agent: treat any instance as a blocker, not a style note.

---

## AP-001 — `database as never` (recurring since EPIC-003)

**Pattern:** UI component declares `database: unknown` and casts at every call site with `as never`.

**Why it breaks:** Bypasses type safety entirely. Service functions receive `never`, which TypeScript accepts silently. Type errors at the service boundary are invisible.

**Rule:** The `database` prop must be typed as `DatabaseLike` (exported from `src/services/entity-service.ts`). No `unknown`, no `as never`, no local re-declaration of the DB interface.

**AC fragment to copy:** "database prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites."

---

## AP-002 — TipTap extension as plain object (recurring since M2-S04)

**Pattern:** A new block type's extension is exported as a plain config object `{ name, config }` instead of a `Node.create()` call.

**Why it breaks:** TipTap never registers the node type with the ProseMirror schema. The editor cannot parse, render, or serialize nodes of that type. The block silently disappears or corrupts documents.

**Rule:** All TipTap extensions must use `Node.create({ ... })`, `Mark.create({ ... })`, or `Extension.create({ ... })`. A plain object is never an extension.

**AC fragment to copy:** "TipTap extension must be created with `Node.create()`; plain config objects are not valid extensions."

---

## AP-003 — `prompt()` / `alert()` for user interaction (recurring since M5-S02)

**Pattern:** Import/export or confirmation dialogs use `window.prompt()` or `window.alert()`.

**Why it breaks:** These are blocking browser-only APIs. In Tauri v2 they either do nothing or trigger an OS-level dialog. They are untestable and inaccessible.

**Rule:** Use React-rendered UI (textarea in a panel, inline form). For file save/open use the Tauri dialog API. No `prompt()`, `alert()`, or `confirm()` anywhere in production code.

**AC fragment to copy:** "No `prompt()`, `alert()`, or `confirm()` calls; all user input via rendered React UI or Tauri dialog API."

---

## AP-005 — `require()` in ESM Vitest tests (recurring since M5-S02/E8-S02/E8-S05)

**Pattern:** Test files use `require('../src/ui/SomeComponent')` or `require('fs')` inside a Vitest ESM context.

**Why it breaks:** Vitest runs in ESM mode. `require()` is not defined in ESM — the call throws `ReferenceError: require is not defined` at runtime, making every assertion in that test permanently fail. The error is not a test failure in the meaningful sense; it is a broken test harness.

**Rule:** Never use `require()` in test files. Always use ESM `import`. For dynamic imports use `await import(...)`. For Node built-ins (fs, path) use `import { readFileSync } from 'node:fs'`.

**AC fragment to copy:** "Test file must use ESM `import` exclusively; no `require()` calls."

---

## AP-004 — Raw HTML interpolation of user data (first found E8-S09)

**Pattern:** User-supplied strings (titles, labels, IDs from SQLite) are interpolated directly into HTML template literals for export.

**Why it breaks:** XSS. Exported HTML files opened in a browser execute injected scripts with `file://` privileges. Shared campaign files become attack vectors.

**Rule:** Every value sourced from user input or the database that appears in an HTML output must be passed through an HTML escape function before interpolation. Add a `Content-Security-Policy` meta tag to all exported HTML.

**AC fragment to copy:** "All user-supplied strings HTML-escaped before interpolation in exported HTML; CSP meta tag present in output."
