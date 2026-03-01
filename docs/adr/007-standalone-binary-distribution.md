# ADR-007: Standalone Binary Distribution via Bun + Homebrew

## Status

Accepted

## Date

2026-03-01

## Context

npm publishing is blocked by a name similarity filter ("gspend" vs "send"). While
waiting for npm support to approve the name, we need an alternative distribution
channel. Additionally, `better-sqlite3` is a native C++ addon that requires a
matching Node.js ABI version and a build toolchain — a friction point for users.

Options considered:

- **Wait for npm approval** — Could take days/weeks. No distribution in the meantime.
- **pkg/nexe (Node.js binary)** — Can't easily bundle native addons like `better-sqlite3`.
  Would require prebuilds for each platform.
- **Bun compile + Homebrew** — Bun has built-in SQLite (`bun:sqlite`), eliminating the
  native addon problem entirely. Single binary with zero runtime dependencies.

## Decision

Use Bun's `--compile` flag to produce standalone binaries, distributed via a Homebrew
tap (`mulkatz/homebrew-tap`). Create a thin SQLite abstraction layer so both
`better-sqlite3` (Node.js) and `bun:sqlite` (Bun) work transparently.

## Architecture

### SQLite Abstraction Layer

```
src/store/sqlite-interface.ts  — SqliteDatabase / SqliteStatement interfaces
src/store/sqlite-node.ts       — better-sqlite3 adapter (Node.js development/npm)
src/store/sqlite-bun.ts        — bun:sqlite adapter (standalone binary)
src/store/db.ts                — Runtime detection + async adapter loading
```

Runtime detection: `typeof Bun !== 'undefined'` selects the Bun adapter, otherwise
Node.js. The adapter is loaded via dynamic `import()` in `initDb()`, called by
Commander's `preAction` hook before any command executes.

### Build Pipeline

Two-step process in `scripts/build-binary.ts`:

1. **Bundle** — `Bun.build()` bundles all source into a single JS file. Uses a plugin
   to stub `react-devtools-core` (Ink's optional devtools dependency). Injects version
   from `package.json` via `define`.
2. **Compile** — `bun build --compile` produces the standalone binary. Accepts
   `--target` for cross-compilation (darwin-arm64, darwin-x64, linux-x64, linux-arm64).

### Release Workflow

The GitHub Actions release workflow (`.github/workflows/release.yml`) builds binaries
for 4 platform/arch combinations via a matrix strategy, creates a GitHub Release with
the tarballs, and updates the Homebrew formula with SHA256 checksums.

## Consequences

- **Dual-runtime support** — Code must work under both Node.js and Bun. The abstraction
  layer is the only place where this difference surfaces.
- **Test coverage** — Tests run under Node.js (vitest) using `better-sqlite3`. The Bun
  adapter is validated by the binary build + manual testing.
- **Version injection** — Binary uses `__GSPEND_VERSION__` define instead of reading
  `package.json` at runtime (which doesn't exist in the compiled binary).
- **Type declarations** — `src/types/bun-sqlite.d.ts` provides minimal types for
  `bun:sqlite` so tsc can compile the Bun adapter without installing `@types/bun`.
