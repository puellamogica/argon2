# Memory

## Project Overview

See @README.md for the full API contract and @package.json for available npm/pnpm commands for this project.  
Short version: a single-purpose Hono service on Vercel (`nodejs24.x`) exposing one HMAC-authenticated `POST` endpoint that runs `argon2.verify`. It is called only by a Cloudflare Workers / Astro blog to offload CPU-heavy Argon2id verification. No password is stored. Config is fail-closed.

## Code Style Guidelines

- Use descriptive variable names
- Follow existing patterns in the codebase
- Extract complex conditions into meaningful boolean variables
- Keep shared types in `src/types.ts`, limits/constants in `src/config.ts`, and the errcode contract in `src/errcode.ts`
- Never hardcode the route name or secrets — read them via `loadConfig`
- Keep the dependency surface minimal (`hono` + `argon2`)

## Architecture Notes

- Request flow: `bodyLimit` → read body → HMAC verify → content-type → JSON parse → payload shape/charset → `$argon2id$` prefix + `needsRehash` → `verify` → result.
- `src/index.ts` is both the composition root and the Vercel entry. It registers middleware (`secureHeaders` with HSTS disabled, a global `Cache-Control: no-store`, `methodNotAllowed`), then the root placeholder route and the env-named verify route. It must import `hono` and default-export the app.
- Config is fail-closed: `loadConfig` returns `undefined` (route not mounted → 404) when the route name or HMAC secret is missing/invalid.
- Argon2 policy: argon2id, `m=19456`, `t=2`, `p=1`; `version` is left at the `argon2` package default. `needsRehash` runs before `verify` to cap per-request CPU/memory.
- Errcode values are ordered by execution order (later errors have higher numbers) and are part of the public client contract.

## Common Workflows

- **Change behavior**: edit `src/`, add a test under `test/`, then run `pnpm test`, `npx tsc --noEmit`, `npx tsc -p test/tsconfig.json --noEmit`, `npx eslint src test`, and `npx prettier --check "src/**/*.ts" "test/**/*.ts"`.
- **Verify before deploy**: `npx vercel build` should report `handler: src/index.js` and bundle the argon2 linux-x64 prebuild.
- **Change an errcode**: update `src/errcode.ts`, the tests, and the Cloudflare Worker together.
- **Change the hash policy**: update `ARGON2_VERIFY_OPTIONS` / `HASH_LENGTH` in `src/config.ts` and the hashing side to match.

## Invariants (breaking changes for the Cloudflare Worker)

- Wire format: `Request-Timestamp` + `Request-Signature` headers; hex HMAC-SHA256 over `` `${timestamp}.${rawBody}` ``; `content-type: application/json` (exact); 30s timestamp window.
- Body: `desired_hash` exactly **97** chars (`$argon2id$…`, 16-byte salt, 32-byte output, unpadded base64); `user_input` **5–128** chars of `[A-Za-z0-9!@#$%^&*]`.
- Response is always `{ success, errcode }` (see the table in @README.md).
- Secrets are base64 and must decode to ≥32 bytes (`openssl rand -base64 32`).

## Gotchas

- `@vercel/hono` entry candidates are `app`, `index`, `server`, `src/app`, `src/index`, `src/server`, and the entry must import `hono`. **Never add `src/app.ts`** next to `src/index.ts` — `src/app` is checked first and would become the entry, breaking the build (no default export).
- `test/tsconfig.json` exists only so editors typecheck test files with `types: ["node"]`; the root `tsconfig.json` includes only `src`.
- Test secrets must be valid base64 (`Buffer.alloc(32, n).toString("base64")`) — they pass through `hasSufficientEntropy`.
- `argon2` is a native addon; its install script must stay approved in `pnpm-workspace.yaml` (`onlyBuiltDependencies` / `allowBuilds`).
