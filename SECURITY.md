# Security Policy

Seeder handles authentication and multi-tenant project data and is designed to
be self-hosted, so we take security reports seriously.

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Instead, report privately via GitHub:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability** (GitHub Private Vulnerability Reporting).

If private reporting is unavailable, open a regular issue that says only that
you have found a security problem and would like a private channel — do not
include details in the public issue.

Please include, where possible:

- A description of the issue and its impact (e.g. cross-tenant data access,
  privilege escalation, authentication bypass).
- Steps to reproduce or a proof of concept.
- The affected route/file and any relevant configuration.

## Scope

Highest-priority areas: authorization / multi-tenant isolation (project
membership, the admin/owner roles), the invite/onboarding flow, the public
client board share links, and file uploads. Self-hosting misconfiguration
(e.g. not setting `BETTER_AUTH_SECRET`) is the operator's responsibility, but
reports about insecure defaults are welcome.

## Response

We aim to acknowledge a report within a few days and to keep you updated as we
investigate and ship a fix. Thank you for helping keep Seeder and its users
safe.
