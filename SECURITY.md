# Security Policy

## Security Model

gspend is designed with a minimal trust surface:

- **Authentication**: Uses Google Cloud Application Default Credentials (ADC) exclusively. gspend never stores, transmits, or manages credentials directly.
- **Data locality**: All cost data stays on your machine. No telemetry, no analytics, no cloud uploads.
- **Local storage**: SQLite database stored in your OS-standard data directory. Config stored in your OS-standard config directory.
- **Query safety**: All BigQuery queries use parameterized inputs to prevent injection.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.7.x   | Yes       |
| < 0.7   | No        |

## Reporting a Vulnerability

If you discover a vulnerability, please report it responsibly:

1. **Do NOT open a public GitHub issue.**
2. Use [GitHub Security Advisories](https://github.com/mulkatz/gspend/security/advisories/new) to report the issue privately.
3. Include as much detail as possible: steps to reproduce, affected versions, and potential impact.

## Scope

The following are in scope:

- Code execution or injection via CLI input
- Credential leakage or unintended data transmission
- SQL injection in BigQuery queries
- Path traversal in config or data file handling
- Dependency vulnerabilities with a viable exploit path

The following are out of scope:

- Issues requiring physical access to the machine
- Social engineering
- Denial of service against GCP APIs (rate limits are Google's responsibility)
- Vulnerabilities in GCP services themselves

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 7 days
- **Fix release**: As soon as practical, targeting within 30 days for confirmed issues

## Credits

We appreciate responsible disclosure and will credit reporters in the release notes (unless they prefer to remain anonymous).
