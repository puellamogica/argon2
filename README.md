# puellamogica/argon2

Argon2 verification helper

A single-purpose [Hono](https://hono.dev) service on Vercel (`nodejs24.x`) that exposes one `POST` endpoint running `argon2.verify(desired_hash, user_input)`. It offloads CPU-heavy Argon2id verification from a Cloudflare Workers / Astro blog — no password is ever stored here.  
The endpoint is HMAC-authenticated and meant to be called only by that Worker (in addition to Vercel's Deployment Protection bypass header).

## File map

| File             | Responsibility                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`   | Entry point. Middleware (secure headers, `Cache-Control: no-store`, 405 handling) and route registration. Must import `hono` — see Gotchas. |
| `src/verify.ts`  | The verify route: body limit → HMAC → content-type → JSON → payload shape → Argon2id prefix + `needsRehash` → `verify`.                     |
| `src/hmac.ts`    | HMAC-SHA256 signing/verification, constant-time compare, timestamp window.                                                                  |
| `src/config.ts`  | Constants (limits, header names, Argon2 policy) and `loadConfig(env)`.                                                                      |
| `src/errcode.ts` | The `ErrCode` table (public contract).                                                                                                      |
| `src/types.ts`   | Shared types.                                                                                                                               |
| `test/`          | Vitest suites (`*.test.ts`); `test/tsconfig.json` lets editors typecheck them with Node types.                                              |

## Environment variables

Config is **fail-closed**: if a required value is missing or invalid, the route is not mounted (404) and a warning is logged at startup.

| Variable              | Required | Notes                                                                     |
| --------------------- | -------- | ------------------------------------------------------------------------- |
| `ARGON2_VERIFY_ROUTE` | yes      | Path segment, `^[a-z0-9]{1,64}$`. The route is `/<value>`.                |
| `ARGON2_HMAC_SECRET`  | yes      | Base64 encoding ≥32 bytes (256-bit). Generate: `openssl rand -base64 32`. |
| `ARGON2_PEPPER`       | no       | Optional Argon2 pepper (same base64 rule). Must match the hashing side.   |

## API

`POST /<ARGON2_VERIFY_ROUTE>`

Request headers:

- `content-type: application/json` — exact, no `; charset=...`
- `Request-Timestamp` — Unix time in **seconds**
- `Request-Signature` — hex HMAC-SHA256 over `` `${timestamp}.${rawBody}` `` using `ARGON2_HMAC_SECRET`
- `x-vercel-protection-bypass` — optional; Vercel Deployment Protection

Request body:

```json
{ "desired_hash": "<PHC argon2id hash>", "user_input": "<password>" }
```

- `desired_hash` — exactly **97** characters: a `$argon2id$` PHC string produced with the pinned policy below (16-byte salt, 32-byte output, unpadded base64).
- `user_input` — **5–128** chars from `A-Z a-z 0-9 ! @ # $ % ^ & *`.

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

- Variant **argon2id** (enforced by `$argon2id$` prefix); `version` is left at the `argon2` package default.
- Pinned cost: `memoryCost=19456` (19 MiB), `timeCost=2`, `parallelism=1` — OWASP's minimum for Argon2id, tuned for a 1 vCPU / 2 GB function.
- `needsRehash(desired_hash, ...)` rejects anything outside that policy **before** hashing, which caps per-request CPU/memory.
- Optional pepper via `ARGON2_PEPPER`, passed as argon2's `secret` to both hash and verify.

## Development

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

## Deploy

```bash
npx vercel deploy
```

- The `argon2` native addon ships automatically (linux-x64 prebuild verified). Its build script must stay allowed in `pnpm-workspace.yaml` (`onlyBuiltDependencies` / `allowBuilds`).
- Vercel entry detection: `@vercel/hono` looks for `app`, `index`, `server` (and `src/...`), and the entry must import `hono`. Keep `src/index.ts` the only such file — see Gotchas.

## Security model and operations

- Two independent gates: Vercel Deployment Protection (bypass header) and the request HMAC.
- Configure a Vercel WAF rate-limit rule on the route path. On Hobby you get 1 rate-limit rule and the counting keys are IP/JA4 only. The WAF runs _after_ Deployment Protection, so requests that use the bypass header are still rate-limited.
- Rotate `ARGON2_HMAC_SECRET` and the bypass token together on suspected leak; both sides must be redeployed.
- All responses are `Cache-Control: no-store`, plus `X-Content-Type-Options: nosniff` et al. HSTS comes from Vercel, so the app deliberately does not set it.

## Gotchas

- Changing errcodes, header names, the signed string, or the body shape is a **breaking change** for the Worker — update both sides together.
- Test secrets must be valid base64 (they pass through `hasSufficientEntropy`); use `Buffer.alloc(32, n).toString("base64")`.
- `needsRehash` is an exact match: if the hashing side's cost params change, update `ARGON2_VERIFY_OPTIONS`.
- The hash length is exact (`HASH_LENGTH = 97`); if the hashing side changes salt/output size or base64 padding, update it.
- **Do not add `src/app.ts`.** `@vercel/hono` checks `src/app` before `src/index` and would pick it as the entry, breaking the build (no default export).
