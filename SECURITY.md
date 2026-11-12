# Security Policy

## Supported versions

Only the latest released version of the extension receives security fixes.

## Reporting a vulnerability

Please do **not** open a public issue for security problems.

Use GitHub's private reporting: **Security → Report a vulnerability** in this repository.
If that is unavailable, contact the maintainer through the email on their GitHub profile.

You can expect an initial response within 7 days. Please include the affected version,
steps to reproduce and the potential impact.

## Scope notes

The tasks download uv from its GitHub releases and Python builds through uv on the build agent. Report
problems in those projects to them; report here anything about how the tasks download, verify or run them.

## How the project protects its supply chain

- CI runs on `pull_request` only (never `pull_request_target`), with a read-only token and no secrets.
- Every action is pinned to a full commit SHA, and `scripts/check-workflows.js` enforces these rules in CI.
- Dependencies are installed from the lockfile with `--ignore-scripts`, and their registry signatures are verified.
- Dependabot waits 7 days (30 for majors) before proposing a new version.
- CodeQL analyzes the code on every pull request and weekly.
