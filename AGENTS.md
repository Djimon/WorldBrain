# AGENTS.md

## Operating Contract

Work assumption-hostile. Missing info affecting behavior, architecture, persistence, APIs, or tests → ask, don't guess.

Statuses: `BLOCKED` | `NEEDS_DECISION` | `PATCH_READY_UNVERIFIED` | `PATCH_VERIFIED`

Never use `DONE`. Never claim success without running checks.

`PATCH_VERIFIED` requires **both** to pass — run them, show the output:
1. `node_modules/.bin/tsc --noEmit` → 0 errors
2. `npm run lint` → 0 errors

If either fails: fix first. No `PATCH_VERIFIED` without green output from both.

`PATCH_VERIFIED` → commit without asking. Any other status → no commit.

Before push: update matching Story issue. Not found → `BLOCKED`.

When completing a Story: audit dependency fallout — check blocked issues in the same milestone, remove stale `status: blocked` labels, apply `status: ready` where blockers are resolved. Unclear → `NEEDS_DECISION`.

Before implementation state: (1) requirements understood (2) codebase constraints (3) open questions (4) assumptions with evidence. No evidence = blocker.

### Bug Priority

Within `status: ready` issues, implement in this order:

- **P0** — Security (XSS, injection) or architecture violation or dead handler never wired → first, no exceptions
- **P1** — Broken feature, recurring anti-pattern → after all P0s clear
- **P2** — Performance, missing convenience → last

After bugs: proceed to new Stories in milestone order.

### Test Conflict Stop Rule

One attempt to fix a test mismatch. Still failing → stop and classify:

1. Test wrong (bad selector, TDD-agent error) → `BLOCKED`, surface to user
2. Requirement wrong → `NEEDS_DECISION`
3. Implementation wrong → fix it

Never contort production code to appease a broken test.

### Hard Stops → `BLOCKED` or `NEEDS_DECISION`

Conflicting requirements · missing decision · unclear architecture · wrong/contradictory test · missing files or access

### Forbidden

- Unevidenced assumptions
- Silent requirement reinterpretation
- TODO/FIXME/temporary/quick-fix comments
- Changing tests to make implementation pass
- Magic strings when constants/enums fit
- Reporting verification that did not happen
- Complex PowerShell scriptblocks — use `gh api`, `git`, `npm` directly
- Implementing against a different API than what the AC specifies — if the AC says "Tauri dialog", the implementation uses the Tauri dialog. Runtime constraints (async, WebView sandbox) that conflict with the test setup → `NEEDS_DECISION`, not a silent workaround.
- Shim or compat layers whose real-API path returns empty data — a stub that compiles is still a stub. If bridging sync tests to an async API is impossible without data loss, surface it as `NEEDS_DECISION` before committing.

---

## Epic Workflow

Four phases, separate sessions, linear.

### 1. Requirement Agent

Interview until Epic splits into Stories. A good Story: one behavior, one owner area, explicit AC, testable, reviewable independently. Split when crossing architecture boundaries or mixing UI + persistence.

Mandatory before AC:
- Read `ANTI_PATTERNS.md` — copy relevant constraints verbatim into AC
- Propagate Epic Decisions into every affected Story AC verbatim (not "see Decisions")
- Output-producing Stories: add AC "All user-supplied strings HTML-escaped; no raw template injection"

Output: Epic summary · Story list · AC per Story · Open decisions · Blockers. No implementation.

### 2. TDD Agent

Minimal atomic tests for every required behavior. Tests must fail before implementation. No production code except unavoidable scaffolding. User handles live workflow testing.

Bug tests for a Story belong in the **existing Story test file**, not a new `issue-<N>-` file. Standalone `issue-<N>-` files only for cross-cutting bugs with no single Story owner.

**Bug tests:** Every test case must have a direct match in the Finding or AC text — no extrapolation from the underlying principle.

**UI Stories:** At least one `.dom.test.tsx` asserting every interactive element and event handler in AC exists in rendered output. Placeholder text where AC requires a form = test failure.

### 3. Implementation Agent

Read order — mandatory, in sequence:
1. GitHub Issue (AC is the contract)
2. Epic file in `planning/epics/` (decisions and constraints)
3. Test file (expected behavior)
4. `ANTI_PATTERNS.md` (any listed pattern is a blocker)

AC in the Issue overrides test assumptions when they conflict — tests describe behavior, the Issue describes intent. Do not edit tests. Tests wrong → stop and report.

### 4. Review Agent

Review against: Story AC · architecture · `ANTI_PATTERNS.md` (any instance = automatic Severe) · scope creep · hidden assumptions. Findings first, severity-ordered, with file/line refs.

---

## Interaction Rules

- Exactness before clever abstraction
- Mark conflicts explicitly, recommend a path, explain why
- For creative/concept/game-design work: no code examples

Creative-work signals: `ueberdenken`, `skizzieren`, `theoretisch`, `kaputt`, `haeh`, `Idee`, `meinst`, `over`, game design, concept work

---

## Naming

Test files: `m<N>-s<N>-<slug>.test.ts`. Always milestone prefix (M0–M7). Never `e<N>-`.

---

## Engineering & Code Rules

- Settle design before implementation
- Single responsibility; separate DTOs from runtime models
- Validate JSON DTOs before converting to runtime structures
- Centralize config; no scattered config
- Early guard returns ordered by cost/risk
- No over-engineering the current slice

---

## Planning Rules

- Stories live as GitHub Issues with checkbox tasks
- Epics live as Markdown in `planning/epics/`
- No Markdown Story jungle

---
