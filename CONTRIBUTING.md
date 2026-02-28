# Contributing to gspend

Thanks for your interest in contributing! This guide will help you get started.

## Prerequisites

- Node.js 22+
- npm
- A GCP account with billing export (for manual testing only — tests use mocks)

## Development Setup

```bash
git clone https://github.com/mulkatz/gspend.git
cd gspend
npm install
npm run dev -- status   # Run CLI in development mode
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev -- <cmd>` | Run CLI via tsx (no build needed) |
| `npm run build` | Compile TypeScript |
| `npm run test` | Run tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | TypeScript type checking |
| `npm run check` | Biome lint + format check |
| `npm run lint` | Biome lint only |
| `npm run format` | Biome format (auto-fix) |

## Code Conventions

- **Strict TypeScript** — no `any`, explicit return types
- **ESM** — `"type": "module"`, `.js` extensions on all imports
- **Biome** for formatting and linting (tabs, single quotes, 100 line width)
- **Named exports only** — no barrel files, no default exports
- **Typed errors** — extend `GspendError`, never throw raw strings
- **Zod** for runtime validation of API responses and config
- **Pure functions** preferred over stateful classes

See [CLAUDE.md](./CLAUDE.md) for the full conventions reference.

## Architecture

```
src/
  cli/          Command implementations (Commander.js)
  gcp/          GCP API wrappers (auth, billing, BigQuery)
  tracker/      Business logic (costs, forecast, trend, budget)
  store/        SQLite persistence (cache, history, migrations)
  ui/           Terminal formatting (tables, charts, colors)
  config.ts     Zod config schema
  paths.ts      XDG-compliant paths (env-paths)
  errors.ts     Typed error hierarchy
```

Architectural decisions are documented in [`docs/adr/`](./docs/adr/).

## Testing

- Tests live next to source files (`*.test.ts`)
- Mock all GCP API responses — never call real APIs in tests
- Use descriptive test names that explain the expected behavior
- Run `npm run test` before submitting a PR

## Pull Request Process

1. **One feature/fix per PR** — keep changes focused
2. **Conventional Commits** — `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`
3. **All checks must pass** — `npm run typecheck && npm run test && npm run check`
4. **Tests required** for new features and bug fixes
5. **No secrets** — never commit API keys, project IDs, or credentials

## Reporting Issues

Use [GitHub Issues](https://github.com/mulkatz/gspend/issues) for bug reports and feature requests. Please include:

- gspend version (`gspend --version`)
- Node.js version (`node --version`)
- Operating system
- Steps to reproduce (for bugs)
