# gspend — See What You've Actually Spent on GCP

> **Status:** Planning / Pre-MVP
> **This is an ideas document, not an official README.**

## What is gspend?

gspend is an open-source CLI tool that connects to GCP Billing APIs to show your
actual cloud spending — in your terminal, right now. No browser, no billing dashboard,
no spreadsheets.

Unlike cost estimators (Infracost, gcosts) that calculate hypothetical costs from YAML
files, gspend shows what you've **actually spent**. Think
[VibeMeter](https://github.com/steipete/VibeMeter) (6,500+ stars, tracks OpenAI/Cursor
costs), but for the GCP ecosystem.

## The Problem

AI developers on GCP have no simple, real-time-ish cost awareness:

- The GCP Billing Dashboard is powerful but **overwhelming**
- Billing data has **4-24+ hour delay** — you can't see today's costs today
- Checking costs requires **browser login** and navigating a complex UI
- There's no quick answer to: *"What has my project cost me this week?"*
- Budget alerts are email-only and not granular enough

VibeMeter proved developers want real-time cost awareness. But nothing like it exists
for GCP infrastructure.

## Target Audience

- **Primary:** AI developers and indie hackers building on GCP (Vertex AI, Cloud Run, Firestore)
- **Secondary:** Freelancers and small teams managing cloud costs
- **Tertiary:** Anyone who deploys to GCP and wants cost visibility without the billing dashboard

## Competitive Landscape

| Tool | What it does | Why it's different from gspend |
|------|-------------|-------------------------------|
| [gcosts](https://github.com/Cyclenerd/google-cloud-pricing-cost-calculator) | Estimates costs from YAML files | Hypothetical costs, not actual spending |
| [Infracost](https://github.com/infracost/infracost) | Terraform cost estimation | Pre-deployment estimates, not runtime costs |
| [OpenCost](https://opencost.io/) | Kubernetes cost allocation | K8s-specific, not general GCP |
| [CloudBurn](https://cloudburn.io/) | IaC cost analysis in PRs | AWS-only |
| [VibeMeter](https://github.com/steipete/VibeMeter) | AI service cost tracking | Cursor/Claude, not cloud infrastructure |
| Vantage, Finout | Cloud cost platforms | SaaS, not open-source CLI |

**The gap:** No open-source CLI tool connects to GCP APIs to show actual spending.

## Data Sources & Latency

**Important:** GCP billing data is inherently delayed. We must be transparent about this.

### Cloud Billing API
- **Latency:** 4-24+ hours
- **Granularity:** Per-service daily costs
- **Setup:** Just needs ADC credentials with billing viewer role
- **Best for:** Quick setup, approximate current-month overview

### BigQuery Billing Export
- **Latency:** Hours (but more granular once available)
- **Granularity:** Per-SKU, per-project, with labels and resource-level detail
- **Setup:** Must be enabled in GCP console first (free to activate, queries cost ~$6.25/TB)
- **Best for:** Detailed breakdowns, historical analysis, precise data

### Strategy
- Support **both** data sources
- BigQuery export as the primary, precise source
- Billing API as fallback / quick-start option
- **Always show data freshness**: "Last updated: 4 hours ago"
- Never claim "real-time" — use "near-real-time" or just show the timestamp

## Authentication

### Required IAM Roles
- `roles/billing.viewer` — Read billing data
- `roles/bigquery.user` — Run BigQuery queries (if using BQ export)
- `roles/bigquery.dataViewer` — Read billing export dataset
- `roles/resourcemanager.projectViewer` — List projects

### Auth Methods (in priority order)
1. **Application Default Credentials (ADC)** — `gcloud auth application-default login`
2. **Service Account Key** — For CI/CD or headless environments (discouraged for local use)

### Onboarding Flow
```
$ gspend init
→ Checking credentials...
→ ✓ ADC found (user@example.com)
→ Checking permissions...
→ ✓ Billing viewer: OK
→ ✓ BigQuery access: OK
→ Discovering projects...
→   1. my-project-prod (billing: 01A2B3-...)
→   2. my-project-staging (billing: 01A2B3-...)
→ Which projects to track? [1,2]: 1
→ Monthly budget for my-project-prod? [USD]: 50
→ BigQuery billing export dataset? [optional]: billing_dataset.gcp_billing_export
→ ✓ Config saved to ~/.config/gspend/config.json
```

## Tech Stack

- **Language:** TypeScript, Node.js 22+
- **CLI Framework:** Commander.js
- **GCP SDK:** @google-cloud/billing, @google-cloud/bigquery
- **Local Storage:** SQLite via better-sqlite3 (caching + history)
- **Terminal UI:** chalk (colors), cli-table3 (tables), cli-progress (bars)
- **Validation:** Zod
- **Testing:** Vitest
- **Linting/Formatting:** Biome
- **Distribution:** npm (`npm install -g gspend`), Homebrew (later)

## Data Model

```typescript
interface GCPProject {
  projectId: string;           // e.g. "my-project-prod"
  displayName: string;
  billingAccountId: string;
  budget?: {
    monthly: number;           // e.g. 50.00
    currency: string;          // from billing account, e.g. "USD"
    warnThresholds: number[];  // e.g. [50, 80, 100] percent
  };
}

interface CostEntry {
  projectId: string;
  date: string;                // ISO date
  service: string;             // e.g. "Cloud Run", "Vertex AI"
  sku: string;                 // specific SKU ID
  description: string;
  amount: number;
  currency: string;
  usage: {
    quantity: number;
    unit: string;              // e.g. "requests", "GB", "vCPU-seconds"
  };
}

interface CostStatus {
  projectId: string;
  today: number;
  thisWeek: number;
  thisMonth: number;
  budgetUsagePercent?: number;
  forecastEndOfMonth?: number;
  topServices: {
    service: string;
    amount: number;
    percent: number;
  }[];
  trend: "rising" | "stable" | "falling";
  dataFreshness: string;       // ISO timestamp of last data point
  dataSource: "bigquery" | "billing-api";
}
```

## CLI Commands (MVP)

### `gspend init`
Discover projects, validate credentials, configure tracking.

### `gspend status`
Main command — current cost overview.
```
$ gspend status
┌─────────────────────────────────┐
│ my-project-prod    February 2026│
│─────────────────────────────────│
│ Today:           $2.34          │
│ This week:       $8.91          │
│ This month:      $31.47 / $50   │
│ Budget:          ██████████░░ 63%│
│ Forecast:        $43.20         │
│─────────────────────────────────│
│ Top Services:                   │
│   Vertex AI      $18.30  (58%) │
│   Cloud Run       $7.20  (23%) │
│   Firestore       $4.12  (13%) │
│   Other           $1.85   (6%) │
│─────────────────────────────────│
│ Trend: ↗ rising (+12% vs last week)     │
│ Data as of: 4 hours ago        │
└─────────────────────────────────┘
```

### `gspend breakdown [--service "Vertex AI"]`
Detailed cost breakdown by service and SKU.

### `gspend history [--days 7]`
Historical cost visualization as ASCII chart.
```
$ gspend history --days 7
Daily costs (last 7 days):
Mon 02/17: $2.10  ██████████
Tue 02/18: $3.45  ████████████████
Wed 02/19: $1.89  █████████
Thu 02/20: $2.34  ███████████
Fri 02/21: $4.12  ████████████████████
Sat 02/22: $0.45  ██
Sun 02/23: $0.32  █
```

### `gspend budget [set <amount>] [--warn <percent>]`
View or configure monthly budget and warning thresholds.

### `gspend watch [--interval 5]`
Live mode — polls and updates the terminal.
```
$ gspend watch
Watching my-project-prod... (Ctrl+C to stop)
[09:15] $31.47 / $50 (63%) — Vertex AI: +$0.34
[09:20] $31.81 / $50 (64%) — Cloud Run: +$0.12
```

## Architecture

```
gspend/
├── src/
│   ├── cli/
│   │   ├── index.ts              # Entry point, Commander setup
│   │   └── commands/
│   │       ├── init.ts
│   │       ├── status.ts
│   │       ├── breakdown.ts
│   │       ├── history.ts
│   │       ├── budget.ts
│   │       └── watch.ts
│   ├── gcp/
│   │   ├── billing.ts            # Cloud Billing API wrapper
│   │   ├── bigquery.ts           # BigQuery billing export queries
│   │   ├── auth.ts               # ADC validation & permission checks
│   │   └── projects.ts           # Project discovery
│   ├── tracker/
│   │   ├── costs.ts              # Cost aggregation & calculation
│   │   ├── budget.ts             # Budget tracking & threshold checks
│   │   ├── breakdown.ts          # Service/SKU breakdown
│   │   └── forecast.ts           # End-of-month projection
│   ├── store/
│   │   ├── db.ts                 # SQLite setup & migrations
│   │   ├── cache.ts              # API response caching
│   │   └── history.ts            # Historical data storage
│   └── ui/
│       ├── table.ts              # Formatted tables
│       ├── chart.ts              # ASCII bar charts
│       ├── gauge.ts              # Budget gauge rendering
│       └── colors.ts             # Color helpers (budget status)
├── docs/
│   ├── adr/                      # Architecture Decision Records
│   └── plans/                    # Implementation plans
├── CLAUDE.md
├── README.md                     # This ideas document
├── package.json
├── tsconfig.json
└── biome.json
```

## Config & Storage

- **Config location:** `~/.config/gspend/config.json` (XDG compliant)
- **Cache/DB location:** `~/.local/share/gspend/gspend.db` (XDG compliant)
- **No telemetry, no analytics, no cloud uploads** — everything stays local

### Config Schema
```json
{
  "projects": [
    {
      "projectId": "my-project-prod",
      "billingAccountId": "01A2B3-...",
      "budget": { "monthly": 50, "warnThresholds": [50, 80, 100] }
    }
  ],
  "dataSource": "bigquery",
  "bigquery": {
    "dataset": "billing_dataset",
    "table": "gcp_billing_export"
  },
  "currency": "USD",
  "pollInterval": 300
}
```

## Rate Limits & Cost of Monitoring

The tool itself should cost essentially nothing to run:

- **Cloud Billing API:** 300 requests/min — more than enough with caching
- **BigQuery:** ~$6.25/TB scanned. Billing export tables are tiny (KB-MB range).
  A typical query costs fractions of a cent. With caching, maybe $0.01-0.05/month.
- **Caching strategy:** Cache API responses in SQLite. Default TTL: 15 minutes for
  status, 1 hour for breakdowns, 24 hours for historical data.

## Error Handling

Every GCP interaction can fail. Handle gracefully:

| Error | User sees |
|-------|-----------|
| No credentials | "Run `gcloud auth application-default login` first" |
| Missing permissions | "Need `roles/billing.viewer`. Run: `gcloud projects add-iam-policy-binding...`" |
| API unreachable | Show cached data with warning: "Showing cached data from 2h ago (GCP API unreachable)" |
| Rate limited | "API rate limit hit. Retry in 60s" with automatic backoff |
| No billing export | "BigQuery export not configured. Using Billing API (less granular). Set up export: [link]" |
| Expired credentials | "Credentials expired. Run `gcloud auth application-default login`" |

## Privacy & Security

- **100% local** — no data leaves your machine
- **No telemetry** — no usage tracking, no analytics, no phone-home
- **Credentials** — handled via ADC, never stored by gspend
- **Cost data** — cached locally in SQLite, user controls retention
- **Open source** — full transparency, auditable code

## MVP Scope (Phase 1)

- [ ] CLI with `init`, `status`, `breakdown`, `history`, `budget`, `watch`
- [ ] GCP Billing API integration via ADC
- [ ] BigQuery billing export support (optional, for detailed data)
- [ ] SQLite caching for fast queries and offline access
- [ ] Budget tracking with configurable thresholds
- [ ] ASCII terminal visualization (bar charts, budget gauge)
- [ ] Data freshness indicators on every output
- [ ] Graceful error handling for all GCP API failures
- [ ] npm distribution (`npm install -g gspend`)

## Future Phases

- **Phase 2:** MCP server mode (`gspend serve`) for AI assistant integration
- **Phase 3:** Multi-project aggregation with combined view
- **Phase 4:** Cost anomaly detection ("Vertex AI costs 3x higher than usual today")
- **Phase 5:** macOS menubar app (SwiftUI, wraps CLI as backend)
- **Phase 6:** Savings recommendations (idle resources, committed use discounts)
- **Phase 7:** Export (CSV/JSON) and webhook integrations

## Open Questions

- [ ] Should `gspend status` be the default (no subcommand)? i.e. just `gspend` shows status?
- [ ] Should we support cost allocation labels from the start?
- [ ] What's the minimum useful polling interval for `watch` mode?
- [ ] Should we show costs in billing account currency or allow override?
- [ ] How to handle multi-currency billing accounts?

---

*Created February 26, 2026.*
