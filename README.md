# Invoice API hardening

[![CI](https://github.com/scott-garvin/invoice-api-hardening/actions/workflows/ci.yml/badge.svg)](https://github.com/scott-garvin/invoice-api-hardening/actions/workflows/ci.yml)

A deliberately vulnerable invoicing API alongside a hardened reference implementation. Both use Express, TypeScript, JWT bearer tokens, and PostgreSQL. The examples and organizations are fictional.

This is a focused security sample, not a complete production service. `before/` was written to illustrate mistakes; it is not evidence about the output of a particular AI tool. `after/` demonstrates specific controls and regression tests.

## What changes

| Problem | Reference implementation | Verification |
| --- | --- | --- |
| Reading or changing another tenant's invoice | Forced PostgreSQL RLS using transaction-local tenant context | Read, update, delete and connection-reuse tests |
| Referencing another tenant's client | Composite foreign key on tenant and client ID | Cross-tenant create is rejected |
| Viewer writes | Role checks on create, edit and delete | Viewer tests |
| PATCH mass assignment | Strict schema with an explicit field allowlist | Unknown tenant fields rejected on create and PATCH |
| SQL injection in search | Parameterized query | Injection string remains data; subsequent search works |
| Decimal drift | Decimal strings converted to integer cents | 0.10 + 0.20 returns 0.30 |
| Hardcoded, non-expiring token | Environment-supplied signing secret and one-hour tokens | Missing, tampered and expired token tests |
| Broad runtime database access | Runtime role cannot read the unscoped user/organization tables | User-directory read is denied |

See [after/tests/hardening.test.ts](after/tests/hardening.test.ts). Tests exercise `after/` against real PostgreSQL; they do not run the same suite against `before/`.

## Run locally

```sh
docker compose up --build -d
docker compose exec after npm run typecheck
docker compose exec before npm run typecheck
docker compose exec after npm test
```

The hardened API listens on `http://127.0.0.1:3010`, the vulnerable example on `http://127.0.0.1:3011`, and PostgreSQL on localhost port 5450. Published ports bind only to loopback. Use only disposable fictional data. Never deploy `before/` or expose these demo credentials publicly.

```sh
docker compose exec after npx tsx src/mint-token.ts adminA
curl http://127.0.0.1:3010/invoices -H "Authorization: Bearer REPLACE_WITH_TOKEN"
```

Minting is a local fixture helper, not a login or identity provider. Tests and seed scripts truncate the example tables. Run them only against this disposable database. `docker compose down` stops the local sample.

## Inspect a fix

1. Read the concatenated search query in [before/src/app.ts](before/src/app.ts).
2. Compare the parameterized query in [after/src/invoices.ts](after/src/invoices.ts).
3. Run `docker compose exec after npm test -- -t "sql injection"`. The test submits an injection string, then checks that the table still works.
4. Run `docker compose exec after npm test -- -t "cross-tenant"` for forbidden reads and writes, including client ownership.
5. Inspect [after/schema.sql](after/schema.sql): RLS scopes invoice rows, while the composite foreign key separately ensures that a referenced client belongs to the invoice tenant.

For manual reproduction, use the fixture IDs in [after/src/seed.ts](after/src/seed.ts), mint `adminB`, create an invoice with its client ID, then GET/PATCH/DELETE the resulting invoice ID with `adminA`. The hardened API returns 404 for each cross-tenant operation. A viewer receives 403 for writes.

The vulnerable API's read route has no tenant predicate. Its local token signing helper is in `before/src/app.ts`; its fixtures are in `before/src/seed.ts`. Keep any exploit experiments confined to that separate disposable database.

## Limits

RLS depends on using the restricted runtime role and trusted authentication-derived tenant context. A superuser bypasses RLS. The app role can set tenant context, so RLS is not a boundary against a fully compromised backend. The tests also verify that transaction-local context clears after commit and rollback.

This sample does not provide identity-provider integration, token revocation, rate limiting, pagination, complete monetary bounds, audit retention, or production secret management. Monetary inputs need explicit business limits before real billing use. JWT claims and malformed route input need additional production validation. The Compose process receives migration credentials for local setup; a real deployment should separate migration and runtime credentials.

CI uses lockfile installs, type-checks both versions, and runs hardened regression tests against PostgreSQL. A green run proves only the covered behaviors. The vulnerable version is type-checked, not certified safe.

[Portfolio](https://scott-garvin.github.io/) · [Agent guardrails](https://github.com/scott-garvin/claude-code-guardrails)
