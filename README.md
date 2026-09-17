# puellamogica/argon2

Argon2 verification helper

A single-purpose [Hono](https://hono.dev) service on Vercel (`nodejs24.x`) that exposes one `POST` endpoint running `argon2.verify(desired_hash, user_input)`. It offloads CPU-heavy Argon2id verification from a Cloudflare Workers / Astro blog — no password is ever stored here.  
The endpoint is HMAC-authenticated and meant to be called only by that Worker (in addition to Vercel's Deployment Protection bypass header).

## File map

| File             | Responsibility                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`   | Entry point. Middleware (secure headers, `Cache-Control: no-store`, 405 handling) and route registration. Must import `hono` — see Gotchas.                   |
| `src/verify.ts`  | The verify route: body limit → HMAC → content-type → JSON → payload shape → Argon2id prefix + `needsRehash` → `verify`.                                       |
| `src/hmac.ts`    | HMAC-SHA256 signing/verification, constant-time compare, timestamp window.                                                                                    |
| `src/config.ts`  | Constants (limits, header names, Argon2 policy) and `loadConfig(env)`.                                                                                        |
| `src/errcode.ts` | The `ErrCode` table (public contract).                                                                                                                        |
| `src/types.ts`   | Shared types.                                                                                                                                                 |
| `test/`          | Vitest suites: `verify-route.test.ts` (route end-to-end), `hmac.test.ts`, `config.test.ts`. `test/tsconfig.json` lets editors typecheck them with Node types. |

## Environment variables

Config is **fail-closed**: if a required value is missing or invalid, the route is not mounted (404) and a warning is logged at startup.

| Variable              | Required | Notes                                                                     |
| --------------------- | -------- | ------------------------------------------------------------------------- |
| `ARGON2_VERIFY_ROUTE` | yes      | Path segment, `^[a-z0-9]{1,64}$`. The route is `/<value>`.                |
| `ARGON2_HMAC_SECRET`  | yes      | Base64 encoding ≥32 bytes (256-bit). Generate: `openssl rand -base64 32`. |
| `ARGON2_PEPPER`       | no       | Optional Argon2 pepper (same base64 rule). Must match the hashing side.   |

Both secrets are used **verbatim**: the exact `openssl rand -base64 32` output string (44 chars) is the HMAC key and the Argon2 `secret` — do **not** base64-decode it on either side. `hasSufficientEntropy` decodes only to measure the byte length.

Set `ARGON2_VERIFY_ROUTE` and `ARGON2_HMAC_SECRET` in the Vercel project (all environments) and locally (e.g. `.env.local`, gitignored). Rotating either secret requires updating the caller and redeploying both sides — see [Maintenance](#maintenance).

## API

`POST /<ARGON2_VERIFY_ROUTE>`

Request headers:

- `content-type: application/json` — trimmed and lowercased before comparison, so the value must be exactly `application/json`; parameters (`; charset=...`) and lookalikes (`application/jsonp`) are rejected.
- `Request-Timestamp` — Unix time in **seconds**
- `Request-Signature` — hex HMAC-SHA256 over `` `${timestamp}.${rawBody}` `` using `ARGON2_HMAC_SECRET`
- `x-vercel-protection-bypass` — optional; Vercel Deployment Protection

Request body:

```json
{ "desired_hash": "<PHC argon2id hash>", "user_input": "<password>" }
```

- `desired_hash` — **≤512** characters: a `$argon2id$` PHC string produced with the pinned policy below (16-byte salt, 32-byte output, unpadded base64). Its params/version are validated by `needsRehash` before any hashing.
- `user_input` — **15–128** chars from `A-Z a-z 0-9 ! @ # $ % ^ & *`. The 15-char floor follows OWASP / NIST SP 800-63B, which treats password-only authenticators under 15 characters as weak.

### Request limits

| Limit           | Value                                     | Enforced in                       |
| --------------- | ----------------------------------------- | --------------------------------- |
| Total body size | 4 KB (`MAX_BODY_BYTES`) → 413             | `bodyLimit` before the handler    |
| `desired_hash`  | ≤512 chars (`MAX_HASH_LENGTH`)            | payload shape, then `needsRehash` |
| `user_input`    | 15–128 chars, `[A-Za-z0-9!@#$%^&*]`       | payload shape                     |
| Timestamp skew  | ±30s (`HMAC_TIMESTAMP_TOLERANCE_SECONDS`) | `isSignatureValid`                |

The signature is verified **before** the content-type, JSON parse, and payload checks, so every unauthenticated request fails with `UNAUTHORIZED` regardless of body.

Response is always `{ "success": boolean, "errcode": number }`:

| errcode | Name                 | HTTP        | Meaning                                        |
| ------- | -------------------- | ----------- | ---------------------------------------------- |
| 0       | `OK`                 | 200         | verified                                       |
| 1       | `METHOD_NOT_ALLOWED` | 405         | wrong HTTP method                              |
| 2       | `INVALID_REQUEST`    | 400/413/415 | bad body, size, content-type, shape or charset |
| 3       | `UNAUTHORIZED`       | 401         | missing/invalid signature, or stale timestamp  |
| 4       | `INVALID_HASH`       | 400         | not argon2id, unpinned params, or unparseable  |
| 5       | `INTERNAL_ERROR`     | 500         | unexpected failure in `verify`                 |
| 6       | `MISMATCH`           | 200         | password did not match                         |

Codes are ordered by execution order (later-produced errors have higher numbers) and are part of the client contract.

## Argon2 policy

- Variant **argon2id** (enforced by `$argon2id$` prefix); `version` is left at the `argon2` package default (`0x13`).
- Pinned cost: `memoryCost=19456` (19 MiB), `timeCost=2`, `parallelism=1` — OWASP's minimum for Argon2id, tuned for a 1 vCPU / 2 GB function.
- `needsRehash(desired_hash, ...)` rejects anything outside that policy **before** hashing, which caps per-request CPU/memory.
- Optional pepper via `ARGON2_PEPPER`, passed as argon2's `secret` (the literal env string's UTF-8 bytes) to both hash and verify.

## Development

Prerequisites: **Node 24.x** and **pnpm 12.4.2** (pinned via `packageManager`; enable with `corepack enable`).

```bash
pnpm install
npx vercel dev        # http://localhost:3000
```

Set `ARGON2_VERIFY_ROUTE` and `ARGON2_HMAC_SECRET` locally (e.g. `.env.local`, gitignored) or the route will not mount.

## Tests and checks

```bash
pnpm test                               # vitest
npx tsc --noEmit                        # src
npx tsc -p test/tsconfig.json --noEmit  # src + tests
npx eslint src test
npx prettier --check "src/**/*.ts" "test/**/*.ts"
```

- The `pre-commit` hook (husky → lint-staged) runs `eslint --fix` and `prettier --write` on staged files.
- There is **no CI workflow**: these commands plus the hook are the only gate, so run them before every deploy.

## Deploy

```bash
npx vercel deploy
```

- The `argon2` native addon ships automatically (linux-x64 prebuild verified). Its build script must stay allowed in `pnpm-workspace.yaml` (`onlyBuiltDependencies` / `allowBuilds`).
- Vercel entry detection: `@vercel/hono` looks for `app`, `index`, `server` (and `src/...`), and the entry must import `hono`. Keep `src/index.ts` the only such file — see Gotchas.
- Project settings: **Function Max Duration = 10s** (verified against the Argon2id cost above; a stuck invocation should not hold a 2 GB instance for the 300s Hobby default). Hobby memory is fixed at 2 GB / 1 vCPU and cannot be changed; Hobby allows a single function region, selectable in the dashboard.

## Security model and operations

- Two independent gates: Vercel Deployment Protection (bypass header) and the request HMAC. The bypass token is the only edge gate, so rotate it together with `ARGON2_HMAC_SECRET` on suspected leak; both sides must be redeployed.
- Per-user abuse control lives in the **Cloudflare Worker**, before signing, and is now in place on both sides: a WAF rate-limiting rule on the caller's `POST /api/auth` (10 requests per 10s per address), plus Workers Rate Limiting bindings inside the Worker — one keyed on `CF-Connecting-IP` (8 per 10s, deliberately one below the edge rule so the Worker's own JSON 429 is what the reader sees rather than a block page) and one keyed on the target slug (30 per 60s, which is what bounds guesses against a single post when they arrive from many addresses). Do not rely on a Vercel WAF rate-limit rule: the WAF runs _after_ Deployment Protection, so unauthenticated traffic never reaches it, and the bypass token lets the Worker's traffic through it. Vercel's platform DDoS mitigation still applies.
- Do not add WAF challenge/deny rules on the route — the Worker is a non-browser client.
- The caller must not follow redirects. It signs each request and sends the bypass header, so its `fetch` uses `redirect: "manual"` and treats a 3xx as a failed call; [Cloudflare's `Request` documentation](https://developers.cloudflare.com/workers/runtime-apis/request/) warns that `follow` forwards every header, `Cookie`, `Authorization` and application-specific ones included, to the redirect destination.
- All responses are `Cache-Control: no-store`. The app sets `Content-Security-Policy: default-src 'none'`; `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` et al. come from `secureHeaders`. HSTS comes from Vercel, so the app deliberately does not set it.

## Maintenance

This service has no database or state: every change is reviewed as code, and its only coupling is to the calling Cloudflare Worker. Keep these two in sync.

### Caller contract (breaking changes)

Change any of these and the Worker must be updated and redeployed in the same release:

- Wire format: `Request-Timestamp` / `Request-Signature` header names, the signed string `` `${timestamp}.${rawBody}` ``, hex HMAC-SHA256, and the 30s timestamp window.
- Body shape: `desired_hash` / `user_input` field names, and the `desired_hash ≤512` / `user_input 15–128` / charset validation.
- Response: the `{ success, errcode }` shape and every value in the `ErrCode` table.
- Secrets: the raw base64 strings (verbatim) and the optional `ARGON2_PEPPER` used as Argon2's `secret`.

### Dependency updates

- Dependabot opens weekly grouped PRs (production vs. development) via `.github/dependabot.yml`; `hono` and `argon2` are the only runtime dependencies.
- Keep `packageManager` and `engines.node` in `package.json` aligned with the Vercel project (`nodejs24.x`).
- If `argon2`'s install script stops being approved in `pnpm-workspace.yaml`, the native prebuild silently stops installing — keep it listed under `onlyBuiltDependencies` / `allowBuilds`.

### Documentation

- `AGENTS.md` holds the agent-facing summary (architecture, invariants, gotchas); this file is the full contract.
- When behavior, limits, errcodes, env vars, or the request flow change, update both files in the same PR.

## Gotchas

- Changing errcodes, header names, the signed string, or the body shape is a **breaking change** for the Worker — update both sides together (see [Maintenance](#maintenance)).
- Raising the `user_input` floor to 15 is a breaking change: the blog must handle existing 5–14 char passwords (reset/upgrade).
- Test secrets must be valid base64 (they pass through `hasSufficientEntropy`); use `Buffer.alloc(32, n).toString("base64")`.
- `needsRehash` is an exact match: if the hashing side's cost params change, update `ARGON2_VERIFY_OPTIONS`.
- `desired_hash` is capped at `MAX_HASH_LENGTH` (512) and its PHC shape is delegated to `needsRehash`. `needsRehash` validates the id/version/params but not the salt/hash **byte lengths**, so a parseable hash with the wrong salt/hash size reaches `verify` and returns `INTERNAL_ERROR` (500) instead of `INVALID_HASH`. Only the signed Worker can trigger this.
- **Do not add `src/app.ts`.** `@vercel/hono` checks `src/app` before `src/index` and would pick it as the entry, breaking the build (no default export).
