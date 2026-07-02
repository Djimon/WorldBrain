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

---

## AP-007 — Infinite test-fix loop (recurring since M6-S06)

**Pattern:** Test fails → fix → still fails → agent reasons 20+ lines about structural impossibility → tries another approach → repeat. The agent never invokes the stop rule.

**Why it breaks:** Produces convoluted production code shaped around broken tests. Wastes context. The Test Conflict Stop Rule in AGENTS.md exists precisely for this.

**Rule:** After ONE fix attempt that still fails, stop and classify:
1. Test wrong (impossible DOM expectation, selector mismatch) → `BLOCKED`
2. Requirement ambiguous → `NEEDS_DECISION`
3. Implementation wrong → fix it (only branch allowing a second attempt)

"I almost have it" is not grounds to continue. Reasoning for more than 3 lines about why a test is structurally unpassable = you already know the answer is `BLOCKED`.

**AC fragment to copy:** "If test fails after one fix attempt, classify as BLOCKED/NEEDS_DECISION before attempting further changes."

---

## AP-008 — Unanchored RTL substring assertion (recurring since M8-S02/S05/S10)

**Rule:** React Testing Library queries must be uniquely satisfiable. Anchor accessible-name / text regexes so they cannot match a sibling element:

1. Anchor names with `^…$` whenever one expected label is a substring of another: `/^(w|d)10$/i` — never `/w10|d10/i` (matches `W100` too). Same for `Archivieren` vs `Archiv anzeigen` → `/^archivieren$/i`.
2. No bare `|<digit>` or `|<generic-fragment>` catch-all in `getByText` (e.g. `/runde.*3|3/i`) — the fallback matches any element containing that fragment (dates, timestamps). Assert the concrete rendering: `/runde\s*3\b|\(3\)/i`.
3. `getBy*` **throws** on zero/multiple; `queryBy*` returns null. `||` / `??` fallback chains must use `queryBy*` only — `getByRole(...) || queryByLabelText(...)` throws before the fallback runs.
4. When multiple matches are legitimately expected, use `getAllBy*(...).toHaveLength(n)` or scope with `within(el)` — never a bare `getBy*`.

**Why:** An unanchored substring regex that collides with a second rendered element makes the assertion throw "found multiple elements" — **unpassable regardless of a correct implementation**. This is a test defect owned by the TDD Agent (Test Conflict Stop Rule case 1 → `BLOCKED`); the implementor must not contort production code, and re-labeling the story `ready` without fixing the assertion produces label churn.

**AC fragment:** "All RTL name/text queries anchored (`^…$`) where labels share a prefix; no bare `|<fragment>` catch-all; `||`/`??` fallbacks use `queryBy*`; multi-match uses `getAllBy*`/`within`."

---

## AP-008 — `if (prop)` as service call gate (recurring since M2)

**Rule:** Service calls must not be gated on prop existence. Optional props are passed through; the service handles missing data.

**Why:** In tests where a prop is optional but a mock is provided, the guard blocks the mock from being reached — assertions fail silently as if the service was never called.

**AC fragment:** "No `if (database)` / `if (service)` guards before service calls; optional props are passed through unconditionally."
