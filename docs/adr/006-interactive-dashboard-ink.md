# ADR-006: Interactive Terminal Dashboard with Ink

## Status

Accepted

## Date

2026-02-28

## Context

gspend's static commands (`status`, `breakdown`, `history`) work well for
scripting and CI, but exploring cost data interactively requires running
multiple commands. Users want a single dashboard they can navigate with
keyboard shortcuts — tab between views, drill into services, filter by project.

Options considered:

- **blessed/blessed-contrib** — Mature but abandoned, no ESM support, complex API.
- **Custom ANSI** — Full control but massive effort for layout, input handling,
  and resize. Essentially rebuilding a TUI framework.
- **Ink (React for terminal)** — React component model for terminal UIs. Active
  maintenance, ESM-native, composable components, familiar mental model.

## Decision

Use **Ink v6** with **React 19** for the interactive dashboard:

- `.tsx` files in `src/dashboard/` compiled alongside existing code
- `"jsx": "react-jsx"` in tsconfig (auto-transform, compatible with `verbatimModuleSyntax`)
- Dynamic import in the dashboard command so React only loads when needed
- Static commands unchanged — dashboard is additive
- Data hooks (plain `.ts`) wrap existing tracker functions (`getCostStatus`,
  `getBreakdown`, `getHistory`) — no duplication of business logic
- **@inkjs/ui** for common patterns (spinners, select inputs)

### Dashboard is the default for TTY

When stdout is a TTY and no subcommand is specified, gspend launches the
interactive dashboard. When piped or given an explicit command, it uses the
existing static output. This preserves scriptability while giving interactive
users a better experience.

### Keyboard navigation

| Key | Action |
|-----|--------|
| 1-4 | Direct tab switch |
| Tab/Shift+Tab | Next/prev tab |
| Up/Down | Navigate within lists |
| Enter | Drill down (breakdown) |
| Esc | Back |
| p | Project filter |
| r | Force refresh |
| q | Quit |

## Consequences

- **Easier:** Rich interactive exploration of cost data. Familiar React patterns
  for building UI. Easy to add new views and components.
- **Harder:** Adds `ink`, `react`, and `@inkjs/ui` as dependencies (~44 packages).
  These only load for the dashboard command (dynamic import), so static command
  performance is unaffected. Bundle size increases for `npm install`.
