# CLAUDE.md – gspend Project Context

## Project Overview
gspend is an open-source CLI tool that shows actual Google Cloud Platform spending
by connecting to GCP Billing APIs. Unlike cost estimators (Infracost, gcosts), gspend
tracks real billing data. Think VibeMeter, but for GCP infrastructure.

## Tech Stack
- TypeScript (strict mode)
- Node.js 22+ runtime
- Biome for linting and formatting
- Commander.js for CLI framework
- GCP APIs: Cloud Billing API, BigQuery (billing export)
- SQLite (better-sqlite3) for local caching
- Vitest for testing

## Project Structure
Single-package CLI tool:
- `src/cli/` – Command definitions (init, status, breakdown, history, budget, watch)
- `src/gcp/` – GCP API wrappers (billing, bigquery, auth, projects)
- `src/tracker/` – Cost calculation, aggregation, budgets, forecasts
- `src/store/` – SQLite local cache
- `src/ui/` – Terminal output formatting (tables, charts, gauges)
- `docs/adr/` – Architecture Decision Records
- `docs/plans/` – Implementation plans

## Code Conventions
- All code, comments, and documentation in English
- Strict TypeScript: no `any`, explicit return types
- Zod for runtime validation of API responses and config
- Named exports only, no barrel files
- Typed custom errors, never throw raw strings
- Pure functions preferred
- Biome for formatting and linting (no ESLint/Prettier)

## Commands
- `npm install` – Install dependencies
- `npm run build` – Build TypeScript
- `npm run lint` – Biome lint
- `npm run format` – Biome format
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
- Config stored in `~/.config/gspend/`

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
