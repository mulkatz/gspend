# ADR-004: CLI Framework & Terminal UI Stack

## Status

Accepted

## Date

2026-02-26

## Context

gspend needs a CLI framework for command routing and argument parsing, plus
terminal UI components for tables, charts, spinners, and interactive prompts.

## Decision

### CLI Framework
- **Commander.js** with `@commander-js/extra-typings` for type-safe commands
- Chosen over yargs (heavier, less TypeScript-native) and citty (smaller ecosystem)

### Terminal UI
- **chalk** — ANSI color output
- **cli-table3** — Formatted table output with border customization
- **ora** — Spinner animations for async operations
- **@clack/prompts** — Interactive prompts for the `init` flow (select, multi-select, text input)
- **env-paths** — XDG-compliant config/data paths across platforms

### Rationale
- All packages are well-maintained with strong TypeScript support
- chalk + cli-table3 + ora is the industry-standard combination
- @clack/prompts provides beautiful interactive flows with minimal code
- env-paths handles macOS/Linux/Windows path differences correctly

## Consequences

- **Easier:** Consistent, well-documented APIs. TypeScript types available for all packages.
- **Harder:** Multiple small packages to maintain. chalk v5+ is ESM-only (requires ESM project).
