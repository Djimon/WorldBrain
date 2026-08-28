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
- **The reader is NEVER the orchestrator.** The person in the chat is the **orchestrator** — they hand the ticket off and never implement it themselves. Every ticket goes to a **cold executor who may never talk to the orchestrator** and has zero chat context. So write each ticket **self-contained for that cold reader**: no references to chat content, private memory files, or conversation jargon (a decision number like `D28` only with its meaning **inlined**); context + setup/run instructions + mount point + environment edge-cases live **inside the ticket**. **Before every `gh issue create`, run a cold-read pass** — grep your own draft for leaks: bare decision-refs, `Memory`, chat jargon, undefined component names, missing setup/mount. For specs/issues the brevity / token-economy bias is **OFF** — thoroughness is the deliverable; "fast" means rebuilding it 2–3× = negative savings.
- Specify the HOW, not just the WHAT: pin mechanism, UI structure, interfaces, named components, controls, interactions, and how it's measured/compared — a Story that only states goals ("compare 3 renderers") drifts. Unclear HOW → ask, don't guess.
- Read `ANTI_PATTERNS.md` — copy relevant constraints verbatim into AC
- Propagate Epic Decisions into every affected Story AC verbatim (not "see Decisions")
- Output-producing Stories: add AC "All user-supplied strings HTML-escaped; no raw template injection"
- UI-component Stories: name the container/mount point in the AC **and** require an integration test that reaches the component through that real mount / user path — not only an isolated `render(<Component/>)`. A component nobody mounts is a dead deliverable. Recurring failure — do not skip: #262, #274, #294, #339.
- UI-component Stories: spec the **UI/UX basics** in the AC — layout/structure, every visual state (active/hover/disabled/feedback), and **build from the design-system primitives in `src/ui/primitives.tsx`** (`Button`, `Panel`, `Field`, `Tabs`, `StatusChip`, `TableSurface`, `ListSurface`). Raw unstyled `<button>`/`<div>`/`<input>`/`<span>` in a delivered UI is a spec failure, not "polish for later". UI/UX sprints are **additive** live-polish on top of a properly-specced UI — they do **not** relieve any Story of a sensible UI spec. Basics belong in the Story; fine-tuning belongs in the sprint.
- Brand-new UI (no existing screen to adapt): the Requirement Agent is weak at inventing visual layout — **ask the user for a sketch / wireframe / reference template before speccing**, and turn that into the Story's UI spec. Adapting an existing screen: name it and say "1:1 wie X". Never invent a novel layout unasked.

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

**The North Star is the AC, not the test.** Tests are tools for verification, not scope definitions. If the test is limited (only source grep, only guards, only a happy path) and the AC requires more—then implement the full AC. “Test green ⇒ done” is explicitly wrong if test coverage < AC coverage. Before every `PATCH_VERIFIED`, check: does the code satisfy every AC line, or only the tested ones? Untested AC items belong in the ticket comment when closing the ticket—they should not be tacitly omitted.

if you have to build **new UI or edit old**: strictly follow: `docs/UIConsolidation/DEV-UI-GUIDE.md`
**A UI component isn't done until it's mounted and reachable.** A passing isolated test (`render(<X/>)`) is NOT "done" — Before marking a UI story done, verify a real path renders it: grep that `<Component` appears outside its own file and tests, and that a route/menu/parent actually reaches it in the running app. 

**Diagnose from structure, not speculation:** Lifecycle/event/render problems → read the actual component hierarchy first. No diagnosis before the relevant file is open.

**Perf changes need a baseline:** Before any performance commit: what was measured, with what tool, value before/after. No perf commits on suspicion.

**Revert without root cause → `BLOCKED`:** If a regression is reverted without knowing why it broke, state that explicitly. Do not present a revert as a fix.

### 4. Review Agent

Review against: Story AC · architecture · `ANTI_PATTERNS.md` (any instance = automatic Severe) · scope creep · hidden assumptions. UI changes **also** against `docs/UIConsolidation/DEV-UI-GUIDE.md`. Findings first, severity-ordered, with file/line refs.

**AC coverage ≠ test coverage:** test-green is not "done" — mirror of the Implementation North Star. Verify every AC line is met, not only the tested ones. Required-but-untested AC gaps are findings, not silent omissions.

**UI mount/reachability:** each delivered UI component must be reached through a real path — grep that `<Component` appears outside its own file/tests and that a route/menu/parent actually mounts it. Built-but-unmounted = automatic Severe (P0 dead-wiring), never "polish later". Recurring — do not skip: #262, #274, #294, #339.

**UI-Guide conformance:** the two `npm run lint` gates catch raw colors + static inline styles *mechanically*. The reviewer catches what they can't: a bespoke class where a primitive/utility already exists, an inline style that is only pseudo-dynamic, a new component-CSS file that should have been token/utility. Reuse over rebuild is the point.

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
- **Read the truth source before typing against it — never invent APIs from memory.** Before writing an `import` from a third-party library not already established in the repo, read the installed types first: `cat node_modules/<pkg>/package.json` (version + exports) and `head node_modules/<pkg>/dist/*.d.ts` (real signatures). Same rule for anything external — DB schemas (read `core_data/*-schema.ts`), config files, JSON contracts. A self-authored `module-shims.d.ts` is an anti-pattern: it makes `tsc` validate against your invention, not reality — green types, dead runtime. If a shim is unavoidable (throwaway spike with intentionally-unbundled deps), it must be a **verbatim copy** from the real `.d.ts` with the source cited in a comment (`// from @pkg/dist/index.d.ts v0.25.3`), never a guess. On runtime errors like "X is not a function/iterable" from a third-party lib, first reflex is re-read the types — not retry, not guess.

---

## Planning Rules

- Stories live as GitHub Issues with checkbox tasks
- Epics live as Markdown in `planning/epics/`
- No Markdown Story jungle

---

## UI/UX Sprint Mode

A separate, lightweight mode for polishing user-feeling — **not** the Epic Workflow.

**Additive, never a substitute.** This mode exists on top of properly-specced UI Stories — it is for live fine-tuning (feel, spacing nuance, micro-interactions), **not** for supplying UI/UX basics a Story should have specified (layout, structure, styled elements from `src/ui/primitives.tsx`, visual states). A Requirement Agent must never defer basic UI specification to "a later UI/UX sprint". Fine-tuning here; basics in the Story.

- One agent is **reviewer and implementer at once**. Tight loops: user tests live, says "X fehlt" / "Icon ändern" → implement immediately, no ceremony.
- **Scope: UI/UX only.** Never touch the base (services, schema, data model, engines). Only presentation and interaction.
- **No TDD, no Epics, no Stories** required.
- Still required: **clean commits per change**, and a **running change/decision log** (like an Epic's issue list — one line per change/decision with rationale) kept in `planning/ui-ux-sprints/<name>.md`.
- **Push at the end of the sprint**, bundled — not per change.

---
