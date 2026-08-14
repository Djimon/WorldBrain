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

### Token Frugality
Always work witch /caveman (skill) unless real explaination, explorative brainstorming is needed.

### Bug Priority

Within `status: ready` issues, implement in this order:

- **P0** — Security (XSS, injection) or architecture violation or dead handler never wired → first, no exceptions
- **P1** — Broken feature, recurring anti-pattern → after all P0s clear
- **P2** — Performance, missing convenience → last
- **p3** - Nice-to-have

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
- Specify the HOW, not just the WHAT: pin mechanism, UI structure, interfaces, named components, controls, interactions, and how it's measured/compared — a Story that only states goals ("compare 3 renderers") drifts. Unclear HOW → ask, don't guess.
- Read `ANTI_PATTERNS.md` — copy relevant constraints verbatim into AC
- Propagate Epic Decisions into every affected Story AC verbatim (not "see Decisions")
- Output-producing Stories: add AC "All user-supplied strings HTML-escaped; no raw template injection"
- UI-component Stories: name the container/mount point in the AC **and** require an integration test that reaches the component through that real mount / user path — not only an isolated `render(<Component/>)`. A component nobody mounts is a dead deliverable. Recurring failure — do not skip: #262, #274, #294, #339.

Output: Epic summary · Story list · AC per Story · Open decisions · Blockers. No implementation.

Mindset: The TDD agent and implementer are pure executors: strong at coding, weak at thinking ahead. Write every issue to be foolproof — spell out all Dos and Don'ts, and hard-wire any cross-issue dependencies. Each agent only ever sees its single issue in isolation, so it's on you to keep the whole project coherent through clearly written issues and explicit connection points.

### 2. TDD Agent

Minimal atomic tests for every required behavior. Tests must fail before implementation. No production code except unavoidable scaffolding. User handles live workflow testing.

Bug tests for a Story belong in the **existing Story test file**, not a new `issue-<N>-` file. Standalone `issue-<N>-` files only for cross-cutting bugs with no single Story owner.

**Bug tests:** Every test case must have a direct match in the Finding or AC text — no extrapolation from the underlying principle.

**Guard assertions:** Absence checks (source grep, `not.toMatch`, "X must not exist") are a regression net, never proof of a behavior AC — allowed only *in addition* to the positive test. Without a recurrence history they belong in lint/architecture, not the suite.

**Refactor with a "behavior must not change" clause:** write characterization tests of the *existing* behavior first; the interface follows from the extracted code. A pre-designed RED test dictates a new interface — and since the test is the contract, it silently turns the refactor into a rewrite.

**UI Stories:** At least one `.dom.test.tsx` asserting every interactive element and event handler in AC exists in rendered output. Placeholder text where AC requires a form = test failure.

**Async assertions:** Assertions depending on async state updates require `waitFor(...)`. Sync `expect(screen.getBy...)` directly after `render()` is only valid when the service is synchronous or not called at all.

**vi.mock completeness:** `vi.mock` for a service module must cover all named exports of that module — not only the ones the primary test needs. Partial mocks cause failures in indirect imports.

**Test strings = UI language:** Test assertions must match the current UI language exactly. On i18n migration, tests migrate with the UI strings.

### 3. Implementation Agent

Read order — mandatory, in sequence:
1. GitHub Issue (AC is the contract)
2. Epic file in `planning/epics/` (decisions and constraints)
3. Test file (expected behavior)
4. `ANTI_PATTERNS.md` (any listed pattern is a blocker)

AC in the Issue overrides test assumptions when they conflict — tests describe behavior, the Issue describes intent. Do not edit tests. Tests wrong → stop and report.

**A UI component isn't done until it's mounted and reachable.** A passing isolated test (`render(<X/>)`) is NOT "done" — it proves the component works in a vacuum, not that any user can reach it. Before marking a UI story done, verify a real path renders it: grep that `<Component` appears outside its own file and tests, and that a route/menu/parent actually reaches it in the running app. If the AC names no mount point, that is a requirement gap — report it (`NEEDS_DECISION`); never close a component nothing renders. This is the single most recurring defect here (#262, #274, #294, #339) — assume it will happen and check every time.

**Diagnose from structure, not speculation:** Lifecycle/event/render problems → read the actual component hierarchy first. No diagnosis before the relevant file is open.

**Perf changes need a baseline:** Before any performance commit: what was measured, with what tool, value before/after. No perf commits on suspicion.

**Revert without root cause → `BLOCKED`:** If a regression is reverted without knowing why it broke, state that explicitly. Do not present a revert as a fix.

### 4. Review Agent

Review against: Story AC · architecture · `ANTI_PATTERNS.md` (any instance = automatic Severe) · scope creep · hidden assumptions. Findings first, severity-ordered, with file/line refs.

**Epic-vs-code deviation:** Check `git log` first — UX-sprint decisions often live only in the commit message, never reaching the Epic. Intentional → record it in the Epic instead of filing a finding. Unclear → ask, don't guess.

**Issue creation:** always use github labels and link fixes/bugs to gh Milestone!

---

## Interaction Rules

- Exactness before clever abstraction
- Mark conflicts explicitly, recommend a path, explain why
- For creative/concept/game-design work: no code examples

Creative-work signals: `ueberdenken`, `skizzieren`, `theoretisch`, `kaputt`, `haeh`, `Idee`, `meinst`, `over`, game design, concept work

---

## Naming

Test files: `m<N>-s<N>-<slug>.test.ts`. Always milestone prefix (M0–M7). Never `e<N>-`.

Plugin ids and directory names: `snake_case` with underscores (`dnd5e_srd`), never hyphens. A plugin's `plugin.json` `id`, its directory under `plugins/`, and any derived `db_prefix` use the same underscore form. Rules content and system mechanics for one game system belong in **one** plugin — never split into parallel plugins.

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

## UI/UX Sprint Mode

A separate, lightweight mode for polishing user-feeling — **not** the Epic Workflow.

- One agent is **reviewer and implementer at once**. Tight loops: user tests live, says "X fehlt" / "Icon ändern" → implement immediately, no ceremony.
- **Scope: UI/UX only.** Never touch the base (services, schema, data model, engines). Only presentation and interaction.
- **No TDD, no Epics, no Stories** required.
- Still required: **clean commits per change**, and a **running change/decision log** (like an Epic's issue list — one line per change/decision with rationale) kept in `planning/ui-ux-sprints/<name>.md`.
- **Push at the end of the sprint**, bundled — not per change.

---
