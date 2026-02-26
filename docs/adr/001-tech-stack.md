# ADR-001: TypeScript CLI with Biome

## Status

Accepted

## Date

2026-02-26

## Context

gspend needs a tech stack for a CLI tool that connects to GCP APIs and renders
terminal output. Key requirements:
- Type safety for complex API response shapes
- Good ecosystem for GCP client libraries
- Fast development iteration
- npm distribution for easy global install

Alternatives considered:
- **Go** — Fast binaries, single file distribution. But GCP client libraries are less
  ergonomic, and the developer (Franz) is more productive in TypeScript.
- **Rust** — Best performance, but over-engineered for a CLI that mostly waits on API
  calls. Steep learning curve for the team.
- **Python** — Good GCP libraries, but distribution is painful (pip, venv, version conflicts).

## Decision

- **TypeScript** with Node.js 22+ as the runtime
- **Commander.js** for CLI framework (mature, well-documented, good TypeScript support)
- **Biome** for linting and formatting (single tool, fast, replaces ESLint + Prettier)
- **Zod** for runtime validation of API responses and config files
- **Vitest** for testing (fast, TypeScript-native)
- **better-sqlite3** for local caching (synchronous, no native dependency issues on modern Node)
- **chalk** + **cli-table3** + **cli-progress** for terminal output

Distribution via npm: `npm install -g gspend`

## Consequences

- **Easier:** Rapid development, full type safety across GCP API responses, large
  ecosystem of terminal UI libraries, simple distribution via npm.
- **Harder:** Requires Node.js runtime (not a single binary). Users need Node 22+
  installed. Binary distribution via Homebrew would require bundling Node or using pkg/bun.
