# ADR-003: ADC-First Authentication with Permission Validation

## Status

Accepted

## Date

2026-02-26

## Context

gspend needs to authenticate with GCP APIs. Authentication must be:
- Simple for developers already using `gcloud`
- Secure (no credentials stored by the tool)
- Clear about what permissions are needed and how to grant them

Options:
- **Application Default Credentials (ADC)** — Google's recommended approach. Uses
  credentials from `gcloud auth application-default login` or environment variable
  `GOOGLE_APPLICATION_CREDENTIALS`.
- **Service Account Key** — JSON key file. Common but Google discourages it for local
  development due to security risks (key rotation, leaks).
- **OAuth2 browser flow** — Custom OAuth consent screen. Over-engineered for a CLI tool.

## Decision

**ADC-first authentication:**

1. Use `@google-cloud/auth-library` to detect and use Application Default Credentials
2. During `gspend init`, validate that the authenticated identity has the required roles:
   - `roles/billing.viewer` — Read billing data
   - `roles/bigquery.user` — Run BigQuery queries (only if BQ export configured)
   - `roles/bigquery.dataViewer` — Read billing export dataset (only if BQ configured)
   - `roles/resourcemanager.projectViewer` — List and discover projects
3. If permissions are missing, show the exact `gcloud` command to grant them
4. Support `GOOGLE_APPLICATION_CREDENTIALS` env var as fallback (for CI/CD)
5. Never store or cache credentials — always delegate to ADC

### Permission check during init
```
$ gspend init
Checking credentials...
✓ ADC found (user@example.com)
Checking permissions...
✓ billing.viewer: OK
✗ bigquery.user: MISSING
  → Run: gcloud projects add-iam-policy-binding PROJECT_ID \
         --member="user:user@example.com" \
         --role="roles/bigquery.user"
```

## Consequences

- **Easier:** Zero credential management for gspend. Works immediately if user has
  `gcloud` configured. Clear error messages guide permission setup.
- **Harder:** Users must have `gcloud` CLI installed and configured. ADC tokens expire
  and need refresh (handled automatically by the auth library, but can cause errors if
  user hasn't run `gcloud auth` recently).
