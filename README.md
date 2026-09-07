# invoice-api-hardening

[![CI](https://github.com/scott-garvin/invoice-api-hardening/actions/workflows/ci.yml/badge.svg)](https://github.com/scott-garvin/invoice-api-hardening/actions/workflows/ci.yml)

A realistic multi-tenant invoicing API, shown twice: the **`before/`** version an AI builder would hand you (looks fine, quietly broken) and the **`after/`** version I'd ship (the same features, hardened — with a test suite proving each fix).

This is what "make my AI-built app production-ready" actually looks like: not a rewrite, but finding the places where *works in the demo* isn't *safe in production*, and closing them.

## The app

An invoicing SaaS: organizations have clients and invoices. Log in (JWT bearer), create and search invoices, update and delete them. Both versions expose the same API and run on Postgres — so the only difference is whether they're safe.

## before → after, vuln by vuln

Each fix in `after/` has a test in [`after/tests/hardening.test.ts`](after/tests/hardening.test.ts) that fails against the `before/` behavior and passes against the fix.

| # | Vulnerability in `before/` | Fix in `after/` |
| --- | --- | --- |
| 1 | **Cross-tenant leak (IDOR):** `GET /invoices/:id` returns any org's invoice — [`before/src/app.ts`](before/src/app.ts) | **Postgres row-level security** scopes every query to the caller's org; another org's invoice is a 404, not a leak — [`after/schema.sql`](after/schema.sql), [`after/src/db.ts`](after/src/db.ts) |
| 2 | **Money as float:** totals summed as JS numbers, so `0.10 + 0.20` drifts | **Integer cents,** parsed from decimal strings without floating point — [`after/src/money.ts`](after/src/money.ts) |
| 3 | **No authorization:** any authenticated user can delete anything | **Role checks** — only an admin can delete — [`after/src/auth.ts`](after/src/auth.ts) |
| 4 | **Mass assignment:** `PATCH` writes whatever keys you send (incl. `org_id`) | **Validated allowlist** (`zod .strict()`) rejects unknown fields — [`after/src/validation.ts`](after/src/validation.ts) |
| 5 | **SQL injection:** search builds SQL by string concatenation | **Parameterized queries** everywhere — [`after/src/invoices.ts`](after/src/invoices.ts) |
| 6 | **Hardcoded JWT secret, no expiry** | **Secret from the environment** (app refuses to boot without it) **+ token expiry** — [`after/src/auth.ts`](after/src/auth.ts) |

### The isolation fix is worth a closer look

`after/` doesn't just add an `org_id = ...` clause to each query and hope no one forgets it. It enforces tenant isolation in the **database** with row-level security, and sets the tenant context per-request as a transaction-local setting:

```ts
// after/src/db.ts — set_config(..., true) is scoped to THIS transaction,
// so a pooled connection can never leak one tenant's context into the next request.
await client.query('select set_config($1, $2, true)', ['app.org_id', orgId]);
```

Even a query that *forgets* the tenant filter returns nothing, because the policy fails closed. That's the difference between "isolated if every developer remembers" and "isolated."

## Run it

```sh
docker compose up --build
# hardened API  -> http://localhost:3000   (Postgres RLS, migrated + seeded)
# the MVP        -> http://localhost:3001   (intentionally vulnerable; separate DB)
```

Mint a demo token and call the hardened API:

```sh
docker compose exec after sh -c "tsx src/mint-token.ts adminA"
curl -s localhost:3000/invoices -H "Authorization: Bearer <token>"
```

## How it's verified

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) spins up Postgres, type-checks both apps, migrates the hardened schema, and runs the full test suite against a real database on every push. The badge above is that suite passing — the isolation, money, authz, mass-assignment, injection, and auth fixes all proven, not just asserted.

## ⚠️ `before/` is intentionally vulnerable

It exists only as the "before." Don't run it against anything real.

## More

Built by Scott Garvin. Portfolio: [scott-garvin.github.io](https://scott-garvin.github.io) · Related: [claude-code-guardrails](https://github.com/scott-garvin/claude-code-guardrails).

## License

MIT — see [LICENSE](LICENSE).
