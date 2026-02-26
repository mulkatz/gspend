# ADR-002: Dual Data Source Strategy (Billing API + BigQuery Export)

## Status

Accepted

## Date

2026-02-26

## Context

GCP provides multiple ways to access billing data, each with different trade-offs:

**Cloud Billing API (v1)**
- Lists costs per service per day for a billing account
- 4-24+ hour data delay
- Simple setup: just needs `roles/billing.viewer`
- Low granularity: no SKU-level detail, no labels

**BigQuery Billing Export**
- Must be explicitly enabled in GCP Console → Billing → Billing Export
- Exports to a BigQuery dataset with per-SKU, per-project, per-label detail
- Similar delay (hours) but much more granular once available
- Queries cost ~$6.25/TB, but billing tables are tiny (fractions of a cent per query)
- Supports resource-level cost attribution via labels

**Cloud Monitoring API**
- Can create custom metrics and alerts
- Not a direct source of billing data
- Useful for alerting but not for cost retrieval

## Decision

Support **both** Cloud Billing API and BigQuery Billing Export:

1. **BigQuery Export** as the primary, recommended data source
   - Most granular data (SKU-level, labels, resource attribution)
   - Required for detailed `breakdown` command
   - Users configure the export dataset during `gspend init`

2. **Cloud Billing API** as the fallback / quick-start option
   - Works immediately with just ADC credentials
   - Enough for `status` command (daily service-level costs)
   - Automatically used when BigQuery export is not configured

3. **Data freshness indicator** on every output
   - Always show when the data was last updated
   - Never use the word "real-time" — show the actual timestamp

4. **Local SQLite cache** to minimize API calls
   - Cache TTL: 15 min for status, 1 hour for breakdowns, 24 hours for history
   - Serve cached data when API is unreachable (with warning)

## Consequences

- **Easier:** Works out of the box with just ADC (Billing API fallback). Power users
  get detailed breakdowns via BigQuery. Caching makes the tool feel fast and works offline.
- **Harder:** Two code paths for data retrieval. Must handle the case where BigQuery
  export exists but has no recent data yet. Users need guidance on enabling BQ export.
