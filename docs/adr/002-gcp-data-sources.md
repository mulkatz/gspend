# ADR-002: BigQuery Billing Export as Sole Data Source

## Status

Accepted (supersedes original dual-source strategy)

## Date

2026-02-26 (updated)

## Context

GCP provides multiple APIs related to billing:

**Cloud Billing API (v1)**
- Manages billing accounts and project associations
- Can list billing accounts and check which projects are linked
- **Does NOT return cost data** — only account/project metadata
- Useful for: discovering accounts, listing projects, checking permissions

**BigQuery Billing Export**
- Must be explicitly enabled in GCP Console → Billing → Billing Export
- Exports to a BigQuery dataset with per-SKU, per-project, per-label detail
- **The ONLY way to programmatically access actual GCP spending data**
- Queries cost ~$6.25/TB, but billing tables are tiny (fractions of a cent per query)
- Data delay: 4-24+ hours depending on export type

**Cloud Monitoring API**
- Can create custom metrics and alerts
- Not a source of billing data

The original ADR assumed the Cloud Billing API could return cost data as a
fallback. Research confirmed this is incorrect — the Billing API only manages
accounts and associations, not cost amounts.

## Decision

**BigQuery Billing Export is REQUIRED** — it is the sole source of cost data:

1. **BigQuery Export** as the only cost data source
   - All cost queries (`status`, `breakdown`, `history`) use BigQuery
   - Users must enable billing export during `gspend init`
   - If no export table is found, gspend shows setup instructions

2. **Cloud Billing API** used only for discovery
   - `listBillingAccounts()` — discover available billing accounts
   - `getProjectBillingInfo()` — check which projects have billing enabled
   - `testIamPermissions()` — verify user has correct access

3. **Data freshness indicator** on every output
   - Always show when the data was last exported
   - Never use the word "real-time" — show the actual timestamp

4. **Local SQLite cache** to minimize BigQuery costs
   - Cache TTL: 15 min for status, 1 hour for breakdowns, 24 hours for history
   - Serve cached data when BigQuery is unreachable (with warning)

## Consequences

- **Simpler:** Single code path for all cost data queries. No dual-source
  complexity or fallback logic.
- **Harder:** Users must enable BigQuery billing export before gspend works.
  The `init` command guides them through this, but it's an extra setup step.
- **Cost:** BigQuery queries cost money, but billing tables are small. Caching
  keeps query volume low.
