# AGENTS.md

## Operating Contract

Work assumption-hostile. Do not guess when missing information can affect behavior, data model, APIs, persistence, architecture boundaries, tests, or project rules.

Use only these final statuses:

- `BLOCKED`
- `NEEDS_DECISION`
- `PATCH_READY_UNVERIFIED`
- `PATCH_VERIFIED`

Never use `DONE`. Never claim success when relevant checks were not run.

When a session reaches `PATCH_VERIFIED`, the agent may create a scoped git commit
without asking for separate confirmation. Do not commit when the final status is
`PATCH_READY_UNVERIFIED`, `NEEDS_DECISION`, or `BLOCKED`.

Before every push, update the matching Story issue and Epic tracking state for
the completed scope. If the relevant issue or epic cannot be found or updated,
stop with `BLOCKED` instead of pushing.

Before implementation, state:

1. Requirements understood.
2. Relevant codebase constraints.
3. Open questions.
4. Assumptions with evidence.

An assumption without evidence is a blocker.

### Hard Stops

Stop with `BLOCKED` or `NEEDS_DECISION` when:

- Requirements conflict.
- A required decision is missing.
- Existing architecture or project rules are unclear.
- A test appears wrong, contradictory, or out of scope.
- Required files, commands, tools, or access are unavailable.

Do not hide gaps in code.

### Forbidden

- Unevidenced assumptions.
- Silent requirement reinterpretation.
- New TODO/FIXME comments.
- Comments like `temporary`, `later`, or `quick fix`.
- Changing tests to make implementation pass.
- Magic strings outside IDs/tags when constants, enums, or config fit.
- Reporting verification that did not happen.

## Epic Workflow

Each substantial user requirement is an Epic unless scoped smaller by the user.
Run the four phases as separate sessions where possible. They are linear and intentionally context-separated.

### 1. Requirement Agent

Interview the user until the Epic can be split into small Stories.

A good Story is small enough for one focused implementation session, has one primary behavior change, one clear owner area, explicit acceptance criteria, and testable unit-level outcomes. Split Stories when they cross architecture boundaries, mix UI and persistence, require unrelated decisions, or cannot be reviewed independently.

Output:

- Epic summary.
- Story list.
- Acceptance criteria per Story.
- Open decisions.
- Blockers.

No implementation.

### 2. TDD Agent

For one Story, write minimal atomic unit tests/assertions for every required behavior.

Rules:

- Prefer true TDD: tests should fail before implementation.
- No broad integration tests by default.
- User handles live workflow testing.
- Do not implement production code except unavoidable test scaffolding.

### 3. Implementation Agent

Implement production code against the selected Story and its tests.

Rules:

- Read the Story and Story tests first.
- Do not edit tests.
- If tests are wrong or incomplete, stop and report. Only the TDD Agent may change tests.

### 4. Review Agent

Review implementation against:

- Story requirements.
- Architecture.
- Code style.
- Test coverage.
- Hidden assumptions.
- Scope creep and over-engineering.

Findings first, ordered by severity, with file/line references where possible.

## Interaction Rules

- Exactness before clever abstraction.
- Mark conflicts explicitly, assess them critically, recommend a path, and explain why.
- Ask for confirmation when assumptions affect behavior, architecture, persistence, data, APIs, or tests.
- Minimize solution reflexes; these rules also apply to simple tasks.
- For creative/concept/game-design work, do not provide code examples.

Creative-work signals include: `ueberdenken`, `skizzieren`, `theoretisch`, `kaputt`, `haeh`, `Idee`, `meinst`, `over`, game design, and concept work.

## Engineering Principles

- System first: settle design before implementation.
- Challenge architecture; prefer best practices over self-built mechanisms.
- If scope is too large, propose an 80/20 compromise.
- Avoid brute force when a better model or boundary is needed.
- Think ahead without over-engineering the current slice.

## Code Rules

- Single responsibility for classes, methods, and services.
- Separate definitions, DTOs, and runtime models.
- Validate JSON DTOs before converting to runtime structures.
- Centralize config; no scattered config.
- Keep JSON/config minimal.
- Use thin-update step-down orchestration with intention-revealing calls.
- Prefer early guard returns, ordered by saved cost/risk.

## Testing Rules

- Story work is verified primarily with minimal atomic unit tests.
- Integration/live workflow testing belongs to the user unless explicitly requested.
- Implementation sessions must not edit tests.

## Planning Rules

- Epics may live as Markdown.
- Stories should preferably live as GitHub Issues.
- Story tasks should be issue checkboxes.
- Avoid a Markdown Story jungle.
