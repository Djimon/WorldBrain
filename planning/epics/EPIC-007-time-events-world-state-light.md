# EPIC-007: Time, Events & World State Light

## Goal

Model campaign time through events, calendars, session time, and lightweight state changes without overbuilding state-at-time.

## Scope

- Calendar presets and wizard.
- Events.
- Timeline views.
- Session time.
- Optional round/counter support.
- Event-driven variable changes as lightweight state.

## Out Of Scope

- Full state-at-time engine in V1.
- Complex RRULE recurrence.
- Calendar configuration hell.

## Open Decisions

- Date/time precision for V1.
- Minimum calendar preset set.
- Event schema relationship to session variables.
- Whether round counters are global, per session, or per scene.

## Sources

- `worldbuilding_architecture_study/03_Time_And_State_Model.md`
- `worldbuilding_architecture_study/10_MVP_Spec_Decisions.md`
- `worldbuilding_architecture_study/11_Module_Dependency_Map.md`
