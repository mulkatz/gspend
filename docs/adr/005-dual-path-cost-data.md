# ADR-005: Dual-Path Cost Data Strategy (Budget Pub/Sub + BigQuery Export)

## Status

Proposed

## Date

2026-02-27

## Context

### The Problem: GCP Has No Cost API

AWS and Azure provide direct cost query APIs:

- **AWS**: `GetCostAndUsage` — one API call returns cost breakdowns, zero setup beyond auth
- **Azure**: `POST /Microsoft.CostManagement/query` — same, auth + one call = done

**GCP has no equivalent.** The Cloud Billing API (v1, v1beta, v2beta) returns only metadata
(account names, project associations, SKU pricing catalog). No endpoint returns actual cost
amounts. The GCP Console uses internal GraphQL APIs that are not publicly accessible. This gap
has been an open feature request since 2019 (Google Issue Tracker #124508767) with no resolution.

This means gspend currently requires users to manually enable BigQuery billing export in the
GCP Console before it can show any cost data. This is a significant onboarding friction point —
especially for new users who just want to see what they're spending.

### Exhaustive API Research (February 2026)

Every potential path to GCP cost data was evaluated:

| Path | Returns Cost Data? | Programmatic Setup? |
|------|--------------------|---------------------|
| Cloud Billing API v1 | No (metadata only) | N/A |
| Cloud Billing API v1beta/v2beta | No (pricing catalog only) | N/A |
| BigQuery Billing Export | Yes (full detail) | No (Console-only) |
| Budget API + Pub/Sub | Yes (aggregate total) | Yes (fully) |
| Cloud Monitoring Metrics | No (no billing metrics exist) | N/A |
| Recommender API | No (projected savings only) | N/A |
| Cost Estimation API | No (hypothetical estimates) | N/A |
| Cloud Asset Inventory | No (resource metadata only) | N/A |
| Service Usage API | No (API enablement only) | N/A |
| Carbon Footprint API | No (emissions data only) | N/A |
| Workspace/Admin SDK | No (separate system) | N/A |
| Looker Studio connectors | Uses BigQuery underneath | N/A |

### The Budget Pub/Sub Discovery

The Cloud Billing Budget API has an underused capability: when a budget is configured with a
Pub/Sub notification topic, Google sends messages approximately every 20 minutes containing
an actual `costAmount` field — the real accrued cost for the billing period.

Example Pub/Sub notification payload:

```json
{
  "budgetDisplayName": "gspend-monitor",
  "costAmount": 142.35,
  "costIntervalStart": "2026-02-01T08:00:00Z",
  "budgetAmount": 999999.00,
  "budgetAmountType": "SPECIFIED_AMOUNT",
  "alertThresholdExceeded": 0.0,
  "currencyCode": "USD"
}
```

This is **fully automatable**: create a budget via API, create a Pub/Sub topic, subscribe to
messages. Zero manual Console steps required. The user only needs to authenticate.

### Comparison of the Two Paths

| | BigQuery Export | Budget Pub/Sub |
|---|---|---|
| **Setup** | Manual Console click | Fully automatable via API |
| **User actions** | 5+ steps (Console) | 0 (gspend does everything) |
| **Granularity** | SKU / project / label / resource | Single total per billing account |
| **Breakdown** | By service, SKU, project, label | None (aggregate only) |
| **Query model** | On-demand SQL queries | Push-based (receive messages) |
| **Latency** | Hours (export delay) | ~20 minutes |
| **Data accuracy** | Final (reconciled) | Estimated (may differ from final bill) |
| **Infrastructure** | BigQuery dataset | Pub/Sub topic + subscription |
| **Cost** | ~$0.01/query (tiny tables) | Free (Pub/Sub free tier) |
| **Persistence** | Permanent (BigQuery table) | Ephemeral (must store locally) |

### Constraints and Limitations of Budget Pub/Sub

- **No breakdown**: `costAmount` is a single number per budget. No per-service,
  per-project, or per-SKU detail. Multiple budgets (one per project) can provide
  per-project totals, but not service-level breakdown.
- **Push-only**: Cannot query on demand. Must listen for messages and store locally.
- **Estimated data**: Google explicitly notes: "costs reported may differ from the
  final costs on your monthly bill."
- **Delivery timing**: "Multiple times per day" — not guaranteed interval, though
  empirically ~20 minutes.
- **Budget limit**: Up to 5,000 budgets per billing account. More than enough for
  per-project monitoring.
- **Required permissions**: `billing.budgets.create`, `billing.budgets.get`,
  `pubsub.topics.create`, `pubsub.subscriptions.create`.

### GCP APIs Used

**Budget creation** (Cloud Billing Budget API v1):
```
POST https://billingbudgets.googleapis.com/v1/billingAccounts/{id}/budgets
```

Required fields:
- `displayName`: Budget identifier (e.g., "gspend-{billingAccountId}")
- `amount.specifiedAmount`: Set very high to avoid actual alerts (e.g., $999,999)
- `thresholdRules`: At least one required (e.g., 0.0 = always notify)
- `notificationsRule.pubsubTopic`: The topic to receive cost notifications
- `budgetFilter`: Optional — can scope to specific projects/services

**Pub/Sub setup** (Cloud Pub/Sub API v1):
```
PUT https://pubsub.googleapis.com/v1/projects/{project}/topics/{topic}
PUT https://pubsub.googleapis.com/v1/projects/{project}/subscriptions/{subscription}
```

**Pub/Sub pull** (to read messages):
```
POST https://pubsub.googleapis.com/v1/projects/{project}/subscriptions/{subscription}:pull
```

### Terraform Issue #4848 Status

The Terraform provider feature request for billing export configuration has been open since
November 2019 (6+ years). 162 upvotes, blocked upstream by the lack of a public API.
A contributor discovered the Console uses an internal `UpdateBigQueryExportSpecification`
GraphQL call — confirming the capability exists internally but Google has not exposed it.
There is no indication this will change soon.

## Decision

Implement a **dual-path cost data strategy** with progressive enhancement:

### Path 1: "Quick Start" — Budget Pub/Sub (Zero-Setup)

Provides immediate cost visibility without any manual Console steps.

**What gspend automates during `init`:**
1. Create a Pub/Sub topic in one of the user's projects (e.g., `gspend-cost-notifications`)
2. Grant the billing service account (`billing-export@system.gserviceaccount.com`)
   publisher permissions on the topic
3. Create a Pub/Sub pull subscription (`gspend-cost-sub`)
4. Create a budget per billing account via the Budget API with:
   - Very high threshold ($999,999) to avoid interfering with real alerts
   - `thresholdRules: [{ spendBasis: "CURRENT_SPEND", thresholdPercent: 0.0 }]`
   - `notificationsRule.pubsubTopic` pointing to the created topic
5. Optionally: create one budget per tracked project for per-project totals

**What gspend does at runtime:**
- Pull latest messages from the subscription
- Store `costAmount` per billing account (and per project if scoped budgets exist)
  in the local SQLite database
- Display aggregate totals in `gspend status`

**User experience:**
```
$ gspend init
  ✓ Authenticated as user@example.com
  ✓ Found 2 billing accounts
  ✓ Selected 5 projects
  ◐ Setting up cost monitoring...
  ✓ Cost monitoring configured (data arrives in ~20 minutes)

$ gspend status    # after ~20 minutes
  This month: $142.35 (estimated)
  ─────────────────────────────────
  ℹ For detailed breakdown by service, enable BigQuery export:
    gspend setup-export
```

### Path 2: "Full Details" — BigQuery Export (One Console Click)

Provides complete cost breakdown with full granularity. Activated when the user wants
more detail than the aggregate total.

**Trigger:** User runs `gspend setup-export` or gspend detects an existing BigQuery
billing export during init/status (auto-discovery, already implemented).

**What changes:**
- All existing BigQuery-based queries become available
- `gspend status` shows full breakdown (services, SKUs, trend, forecast)
- Budget Pub/Sub data becomes secondary (BigQuery is authoritative)

**User experience:**
```
$ gspend setup-export
  Open your browser to enable billing export:
  → https://console.cloud.google.com/billing/012345-ABCDE/export

  Waiting for export table... (refreshing every 5s)
  ✓ Found: my-project.billing_export.gcp_billing_export_v1_012345

  Full cost breakdowns are now available.
```

### Data Source Priority

When both paths are configured:
1. **BigQuery Export** is the authoritative source (more accurate, more granular)
2. **Budget Pub/Sub** provides fallback when BigQuery data is stale (>24h old)
   and serves as the "quick start" total before export is enabled

### Init Flow

```
gspend init
  Step 1: Auth (ADC validation)
  Step 2: Billing accounts discovery
  Step 3: Project selection
  Step 4: Auto-discover BigQuery export ← existing
  Step 5: If no export → set up Budget Pub/Sub (automatic) ← new
  Step 6: Budget configuration
  Step 7: Write config + init DB
```

If BigQuery export is already found in Step 4, the Budget Pub/Sub setup in Step 5
is still performed as a fallback data source, but the user is not bothered about it.

### Config Schema Extension

```typescript
// Addition to existing BigQueryConfig
interface PubSubConfig {
  projectId: string;         // Project hosting the Pub/Sub topic
  topicId: string;           // e.g., "gspend-cost-notifications"
  subscriptionId: string;    // e.g., "gspend-cost-sub"
}

// Budget IDs are stored to allow cleanup
interface BudgetRef {
  budgetName: string;        // Full resource name from API
  billingAccountId: string;
  scopeProjectId?: string;   // If scoped to a specific project
}

// Config extension
interface Config {
  // ... existing fields ...
  pubsub?: PubSubConfig;
  budgets?: BudgetRef[];
}
```

### New Dependencies

| Package | Purpose |
|---------|---------|
| `@google-cloud/pubsub` | Pub/Sub topic/subscription management and message pulling |

The `@google-cloud/billing-budgets` package is already a dependency.

### New Files

| File | Purpose |
|------|---------|
| `src/gcp/pubsub.ts` | Pub/Sub topic/subscription creation, message pulling |
| `src/gcp/budgets-setup.ts` | Budget creation for cost monitoring (distinct from user budget management) |
| `src/tracker/pubsub-costs.ts` | Parse Pub/Sub messages, store in SQLite, serve as cost source |

### Cleanup

When the user runs `gspend cleanup` or uninstalls:
- Delete the Pub/Sub topic and subscription
- Delete the monitoring budgets (not user-created budgets)
- Local SQLite database is user's responsibility

## Consequences

### What Becomes Easier

- **Zero-setup onboarding**: New users see cost data after `gspend init` + ~20 minutes,
  without opening the GCP Console at all
- **Competitive differentiation**: No other GCP cost CLI offers a zero-Console-setup path
- **Progressive disclosure**: Users start with simple totals, upgrade to full detail
  when they need it
- **Faster data for watch mode**: Budget Pub/Sub updates ~every 20 minutes vs BigQuery's
  hours-long export delay

### What Becomes More Difficult

- **Two data paths**: Code must handle both sources, with fallback logic and data
  source indicators
- **Pub/Sub infrastructure**: gspend now creates cloud resources (topic, subscription,
  budgets) that need lifecycle management and cleanup
- **Estimated vs. actual**: Must clearly communicate when data is from Budget Pub/Sub
  (estimated, aggregate) vs BigQuery (final, detailed)
- **New dependency**: `@google-cloud/pubsub` adds to install size
- **Additional permissions**: Users need `billing.budgets.create` and Pub/Sub permissions
  beyond what's currently required

### Risks

- **Budget pollution**: gspend-created budgets appear in the user's budget list. Must be
  clearly named (e.g., "gspend-monitor — DO NOT DELETE") and documented.
- **Pub/Sub costs**: Free tier covers 10GB/month. Budget notifications are tiny (~200 bytes
  each, ~72/day per budget). No realistic cost concern.
- **Breaking changes**: If Google changes the Pub/Sub notification payload format,
  parsing breaks. The payload format is documented but not versioned.
