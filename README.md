# gspend

See what you've actually spent on GCP — right in your terminal.

Unlike cost estimators that calculate hypothetical costs from YAML files, gspend queries your BigQuery billing export to show **real spending data**.

## Prerequisites

- Node.js 22+
- GCP Application Default Credentials (`gcloud auth application-default login`)
- [BigQuery billing export](https://cloud.google.com/billing/docs/how-to/export-data-bigquery) enabled (gspend will guide you through setup)

### Required IAM Roles

- `roles/billing.viewer` — Read billing data
- `roles/bigquery.user` — Run BigQuery queries
- `roles/bigquery.dataViewer` — Read billing export dataset
- `roles/resourcemanager.projectViewer` — List projects

## Installation

```bash
npm install -g gspend
```

## Quick Start

```bash
# 1. Set up credentials
gcloud auth application-default login

# 2. Run the interactive setup wizard
gspend init

# 3. See your spending
gspend
```

## Commands

### `gspend` / `gspend status`

Show current spending overview with today's costs, weekly/monthly totals, trend detection, end-of-month forecast, and top services.

```
--project <id>   Filter to a specific GCP project
--json           Output as JSON
```

### `gspend init`

Interactive setup wizard that discovers your billing accounts, projects, and BigQuery billing export. Creates the config file at `~/.config/gspend/config.json`.

### `gspend breakdown`

Show cost breakdown by service, or drill into a specific service to see SKU-level costs.

```
--service <name>   Show SKU-level breakdown for a service
--month <YYYY-MM>  Show breakdown for a specific month
```

### `gspend history`

Show daily cost history as a bar chart.

```
--days <number>   Number of days to show (default: 14)
```

### `gspend budget`

View or set monthly budgets per project.

```
gspend budget              # View current budget configuration
gspend budget set 500      # Set budget to $500/month for all projects
gspend budget set 500 --project my-proj --warn 90
```

### `gspend watch`

Live-updating cost display that refreshes automatically.

```
--interval <seconds>   Refresh interval (default: 300)
```

## How It Works

gspend reads cost data from your BigQuery billing export — the same data that powers the GCP Billing Dashboard. Results are cached locally in SQLite for fast subsequent queries and offline access.

**Data freshness:** GCP billing data has a 4-24+ hour delay. gspend always shows when the data was last updated so you know exactly what you're looking at.

**Cost of monitoring:** BigQuery billing export tables are tiny. A typical query scans kilobytes and costs fractions of a cent. With caching (15min for status, 1h for breakdowns, 24h for history), gspend costs effectively $0/month to run.

## Privacy

- 100% local — no data leaves your machine
- No telemetry, no analytics
- Credentials handled via ADC, never stored by gspend
- Cost data cached locally in SQLite
- Open source — fully auditable

## License

MIT
