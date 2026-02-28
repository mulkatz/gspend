# CLAUDE.md – gspend Project Context

## Project Overview
gspend is an open-source CLI tool that shows actual Google Cloud Platform spending
by querying BigQuery billing export data. Unlike cost estimators (Infracost, gcosts),
gspend tracks real billing data. Think VibeMeter, but for GCP infrastructure.

**Critical constraint:** The GCP Cloud Billing API does NOT return cost data. It only
manages billing accounts and project associations. BigQuery billing export is the ONLY
way to get actual spending data programmatically (see ADR-002).

## Tech Stack
- TypeScript (strict mode, `verbatimModuleSyntax`, `exactOptionalPropertyTypes`)
- Node.js 22+ runtime, ESM (`"type": "module"`, `"module": "Node16"`)
- Biome v2 for linting and formatting (tabs, single quotes, 100 line width)
- Commander.js for CLI framework
- chalk, cli-table3, ora, @clack/prompts for static terminal UI
- Ink v6 + React 19 for interactive dashboard (see ADR-006), dynamically imported
- GCP APIs: `@google-cloud/bigquery` (cost data), `@google-cloud/billing` (account discovery),
  `@google-cloud/billing-budgets`, `@google-cloud/resource-manager`, `google-auth-library`
- SQLite (better-sqlite3) for local caching and history
- Zod for config validation
- env-paths for XDG-compliant config/data paths
- Vitest for testing

## Project Structure
Single-package CLI tool:
- `src/cli/index.ts` – Entry point, Commander setup, all commands registered
- `src/cli/commands/` – Command implementations (init, status, breakdown, history, budget, watch, dashboard)
- `src/gcp/` – GCP API wrappers (auth, projects, bigquery, budgets)
- `src/tracker/` – Business logic (costs, budget, forecast, trend)
- `src/store/` – SQLite database (db, migrations, cache, history)
- `src/ui/` – Terminal output formatting (colors, table, chart, freshness)
- `src/dashboard/` – Interactive Ink dashboard (App, components, views, hooks)
- `src/config.ts` – Zod config schema, read/write
- `src/paths.ts` – XDG config/data paths via env-paths
- `src/errors.ts` – Typed error classes
- `docs/adr/` – Architecture Decision Records

## Code Conventions
- All code, comments, and documentation in English
- Strict TypeScript: no `any`, explicit return types
- ESM with `.js` extensions on all imports
- Dashboard uses `.tsx` files with `jsx: "react-jsx"` (auto-transform, no `import React`)
- Dashboard components return `ReactNode`, not `JSX.Element` (for `exactOptionalPropertyTypes`)
- Zod for runtime validation of API responses and config
- Named exports only, no barrel files
- Typed custom errors (GspendError base class), never throw raw strings
- Pure functions preferred
- Biome for formatting and linting (no ESLint/Prettier)

## Commands
- `npm install` – Install dependencies
- `npm run build` – Build TypeScript
- `npm run dev -- <command>` – Run CLI in development (via tsx)
- `npm run lint` – Biome lint
- `npm run format` – Biome format
- `npm run check` – Biome check (lint + format)
- `npm run typecheck` – TypeScript type checking
- `npm run test` – Run tests (Vitest)

## Testing
- Vitest as test runner
- Test files: `*.test.ts` co-located next to source
- Mock GCP API responses with fixtures (never call real APIs in tests)
- Use descriptive test names

## Git Conventions
- Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`
- Branch naming: `feat/description`, `fix/description`
- Never commit secrets or credentials
- Keep commits atomic and focused

## Security Rules
- Never hardcode API keys, project IDs, or credentials
- All credential handling via ADC (Application Default Credentials)
- Cost data stays 100% local — no telemetry, no cloud uploads
- Config stored in `~/.config/gspend/`, database in `~/Library/Application Support/gspend/` (macOS)
- All BigQuery queries use parameterized inputs (no SQL injection)

## Documentation Rules
- CLAUDE.md is the single source of truth for AI context
- ADRs for architectural decisions: `docs/adr/{NNN}-{kebab-case-title}.md`
- Plans for implementation: `docs/plans/{NNN}-{kebab-case-title}.md`
- No verbose inline comments — let code speak for itself
- An ADR is warranted when: adding a new component, choosing between alternatives,
  changing data models, or introducing new infrastructure

## CLAUDE.md Update Triggers
Update ONLY when:
- A new dependency is introduced that affects architecture
- A convention changes
- A non-obvious constraint exists that code alone doesn't communicate
