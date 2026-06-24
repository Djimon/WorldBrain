# EPIC-007: Time, Events & World State Light

## Goal

Model campaign time through events, calendars, session time, and lightweight counters without overbuilding state-at-time.

## Scope

- Absolute internal time axis (days) with calendar projection on top.
- Calendar presets + wizard. Import/export.
- Events with participants, location list, visibility, and time precision.
- Timeline views: Chronicle, Calendar month view, Location Timeline, Character Timeline.
- Session clock (world time on session).
- Global persistent counters (e.g. Bastion Turns).
- Encounter counters (temporary, per-encounter, auto-attached to events).
- Event-driven variable changes as lightweight state (events trigger session/global variable writes).

## Out Of Scope

- Full state-at-time engine (data model must not block it for V2).
- Complex RRULE recurrence.
- Gantt view, Causal Graph view (future/plugin).
- Calendar configuration hell (wizard hides complexity).

## Decisions

- **Internal time axis:** Absolute days (`absolute_day` integer). No minutes or ticks as base unit. Events that need sub-day precision store an optional `time_of_day_minutes` field on top of the day. This keeps comparisons, durations, and calendar projections simple.
- **Calendar as projection:** Calendars are display layers on the absolute axis. Multiple calendars can project onto the same axis (parallel reckonings, like eras). Calendars are not the source of truth.
- **Calendar presets V1:**
  - Earth-like (365d, 12 months, 7-day week)
  - Simple Fantasy (360d, 12×30d months)
  - Blank/Custom (wizard, no prefill)
  - Import from JSON (user-supplied calendar file)
  - Export to JSON (for sharing/plugins)
- **Calendar wizard:** Step-by-step: year length → month structure → week days → optional moons/seasons. All steps after the first are optional. Calendar can be refined at any time.
- **Events:** `start_day`, optional `end_day`, optional `time_of_day_minutes`, `precision` (day / month / year / vague), `participants` (list of entity_ids), `locations` (list of location_ids with optional `primary_location_id`), `visibility`. Events can trigger variable changes (write to global or session variable on event creation/activation).
- **Timeline views V1:**
  - **Chronicle:** Sorted event list (newest or oldest first), filterable by type, participant, location, tag.
  - **Calendar view:** Month grid showing events on their days. Used for session planning.
  - **Location Timeline:** All events at a given location, in chronological order.
  - **Character Timeline:** All events a given character participated in, in chronological order.
  - Gantt, Causal Graph, etc. are future/plugin features.
- **Session clock:** Each session has a `world_time_start` (absolute_day). The GM can advance world time manually. Session time elapsed is tracked separately as `elapsed_minutes` (manual mode) and does not need to sync to world time automatically.
- **Global counters:** User-created persistent counters that live alongside the world timeline. Named, typed (number), with optional step size and reset trigger. Example: Bastion Turns, Market Days. Displayed in a counters panel; incrementing a counter is logged to session_log.
- **Encounter counters:** Temporary counters auto-created per encounter/scene. Standard round counter (6s per round default, configurable). Additional counters can be added per encounter (puzzle timer, chase progress). Encounter counters are discarded after the encounter; summary stats (rounds elapsed) are attached to the event that represented the encounter.
- **State-at-time (future-proofing):** No full state-at-time engine in V1. The data model must not block it: events and state changes should be linkable in V2 without migration. Variable changes triggered by events serve as lightweight state for now.

## Open Decisions

- None.

## Story Tracking

| Story | Status | Notes |
|---|---|---|
| M5-S01: Calendar data model & presets | Verified | #67 — core_data/calendar-schema.ts: applyCalendarSchema, CALENDAR_PRESETS (3 presets), dayToDate/dateToDay. |
| M5-S02: Calendar wizard UI | Verified | #68 — src/ui/CalendarWizard.tsx: 3-step wizard, preset selector, import/export. |
| M5-S03: Event schema & service layer | Verified | #69 — core_data/event-schema.ts + src/services/event-service.ts: createEvent, getEvent, listEvents. |
| M5-S04: Chronicle view | Verified | #70 — src/ui/ChronicleView.tsx: chronological list, sort toggle, type filter, event click. |
| M5-S05: Calendar month view | Verified | #71 — src/ui/CalendarMonthView.tsx: month grid, week headers, events on cells, navigation. |
| M5-S06: Location & Character timeline views | Verified | #72 — src/ui/EntityTimeline.tsx: participantId/locationId filter, chronological order. |
| M5-S07: Session clock & global counters | Verified | #73 — src/ui/SessionClock.tsx + src/services/session-variable-service.ts: advance button, global counter panel. |
| M5-S08: Encounter counters | Verified | #74 — src/ui/EncounterCounters.tsx: round counter, 6s elapsed, custom counters, end encounter reset. |

## Sources

- `worldbuilding_architecture_study/03_Time_And_State_Model.md`
- `worldbuilding_architecture_study/10_MVP_Spec_Decisions.md`
- `worldbuilding_architecture_study/11_Module_Dependency_Map.md`
