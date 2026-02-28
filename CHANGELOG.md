# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0](https://github.com/mulkatz/gspend/compare/v0.6.0...v0.7.0) (2026-02-28)

### Features

- Pre-flight checks and wait-and-retry logic in init wizard
- ADC file existence check before attempting authentication
- Detect disabled GCP APIs and show `gcloud services enable` instructions

### Bug Fixes

- Resolve user email from OAuth tokeninfo endpoint instead of service account metadata
- Use OS-correct dynamic config path in init success message

### Documentation

- Add CONTRIBUTING.md with development guide
- Add CHANGELOG.md with full version history
- Add README badges (CI, npm, license, Node version)
- Add GitHub issue and PR templates

### Chores

- Add npm publish workflow with provenance support
- Bump version to 0.7.0

## [0.6.0](https://github.com/mulkatz/gspend/compare/v0.5.0...v0.6.0) (2026-02-28)

### Improvements

- Address code review findings across CLI and core modules
- Rewrite cache and history tests to use exported functions for better isolation

### CI

- Add GitHub Actions workflow for lint, typecheck, test, and build
- Use official Biome action for cross-platform binary resolution
- Fix cross-platform optional dependency resolution in CI lockfile

## [0.5.0](https://github.com/mulkatz/gspend/compare/v0.4.0...v0.5.0) (2026-02-27)

### Features

- Commander.js entry point with global `--project` and `--json` options
- `gspend status` as the default command with spending overview
- `gspend init` interactive setup wizard with billing account and BigQuery auto-discovery
- `gspend breakdown` for service and SKU-level cost breakdown
- `gspend history` with daily cost bar charts
- `gspend budget` for viewing and setting monthly budget thresholds
- `gspend watch` for live-updating cost display with configurable refresh interval
- Build and CLI smoke tests

### Documentation

- Add README with usage and command reference
- Add MIT license

## [0.4.0](https://github.com/mulkatz/gspend/compare/v0.3.0...v0.4.0) (2026-02-27)

### Features

- 7-day trend detection (rising, falling, stable, spike)
- End-of-month cost forecast based on daily average
- Budget status evaluation with configurable threshold alerts
- Cost aggregation with TTL-based caching
- Terminal bar chart and budget gauge rendering
- Data freshness indicators showing cache age
- Status, breakdown, and project selection tables

## [0.3.0](https://github.com/mulkatz/gspend/compare/v0.2.0...v0.3.0) (2026-02-27)

### Features

- Application Default Credentials validation and billing permission checks
- Project and billing account discovery via Resource Manager and Cloud Billing APIs
- BigQuery billing export queries with parameterized inputs
- Budget CRUD operations via Billing Budgets API

## [0.2.0](https://github.com/mulkatz/gspend/compare/v0.1.0...v0.2.0) (2026-02-27)

### Features

- SQLite database singleton with WAL mode for concurrent reads
- Schema migrations with version tracking
- TTL-based query cache for offline access
- Cost history persistence with upsert logic

## [0.1.0](https://github.com/mulkatz/gspend/releases/tag/v0.1.0) (2026-02-27)

### Features

- Typed error class hierarchy (`GspendError` base)
- XDG-compliant config and data paths via `env-paths`
- Color utilities and currency formatting
- Terminal link utilities for clickable URLs
- Zod-based config schema with runtime validation

### Chores

- Initial project setup with TypeScript strict mode, ESM, and Biome
