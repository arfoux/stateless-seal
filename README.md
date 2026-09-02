# stateless-seal

[![npm version](https://img.shields.io/npm/v/stateless-seal?style=flat-square&color=CB3837&logo=npm)](https://www.npmjs.com/package/stateless-seal)
[![npm downloads](https://img.shields.io/npm/dm/stateless-seal?style=flat-square&color=blue)](https://www.npmjs.com/package/stateless-seal)
[![Build](https://img.shields.io/github/actions/workflow/status/arfoux/stateless-seal/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/arfoux/stateless-seal/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

> **Encrypted, purpose-bound, stateless tokens for JavaScript — AES-GCM + Web Crypto, no database needed.**

**Available on npm: [https://www.npmjs.com/package/stateless-seal](https://www.npmjs.com/package/stateless-seal)**

`stateless-seal` creates compact `stseal.v1.<header>.<iv>.<ciphertext>` tokens with explicit `purpose`, `issuer`, `audience`, `expiry`, and `key rotation`. A token sealed for `password-reset` cannot be opened as `session`. Payload is **encrypted**, not just signed.

Use for: password reset, magic links, email verification, invite links, temporary download grants, session cookies, internal handoff tokens.

```ts
import { createSealer } from "stateless-seal";

const sealer = createSealer({
  issuer: "my-app",
  keys: { "2026-05": process.env.SEAL_KEY_2026_05! },
  currentKeyId: "2026-05",
});

const PasswordResetToken = sealer.defineToken<{ userId: string }>({
  purpose: "password-reset",
  ttl: "15m",
  audience: "web",
});

const token = await PasswordResetToken.seal({ userId: "user_123" });
const result = await PasswordResetToken.unseal(token);
if (result.ok) console.log(result.payload.userId);
```

- **Install:** [https://www.npmjs.com/package/stateless-seal](https://www.npmjs.com/package/stateless-seal)
- **Docs:** [`SPEC.md`](./SPEC.md) · [`docs/recipes`](./docs/recipes/README.md) · [`SECURITY.md`](./SECURITY.md)
- **GitHub:** https://github.com/arfoux/stateless-seal

---

## Why?

You don't always need a DB row or JWT claim set. You need a token that says:

- payload is encrypted
- token is only for one specific `purpose`
- only valid for this `issuer` / `audience`
- expires soon
- verifiable without DB lookup

That's what `stateless-seal` does.

## Installation

**npm:** [https://www.npmjs.com/package/stateless-seal](https://www.npmjs.com/package/stateless-seal)

```bash
npm install stateless-seal
# yarn: yarn add stateless-seal
# pnpm: pnpm add stateless-seal
```

Requires Web Crypto API. Works on Cloudflare Workers, Vercel Edge, Deno, Bun, Node.js 18+ (`globalThis.crypto`), and modern browsers. Core does NOT import `node:crypto` so edge stays eligible. See [docs/runtime-support.md](./docs/runtime-support.md).

## Quick Start

### 1. Generate a key

```bash
npx stateless-seal keygen
# or
import { generateSealKey } from "stateless-seal";
console.log(generateSealKey());
```
Store as env: `SEAL_KEY_2026_05="base64url-32-byte-key"` — don't hardcode.

### 2. Create sealer

```ts
import { createSealer } from "stateless-seal";
const sealer = createSealer({
  issuer: "my-app",
  keys: { "2026-05": process.env.SEAL_KEY_2026_05! },
  currentKeyId: "2026-05",
});
```

### 3. Define token

```ts
const SessionToken = sealer.defineToken<{ userId: string }>({
  purpose: "session",
  ttl: "1h",
  audience: "web",
  // optional: schema, maxTokenSize, clockTolerance, notBefore, oneTime
});
```

### 4. Seal / Unseal

```ts
const token = await SessionToken.seal({ userId: "user_123" });
// -> stseal.v1.<header>.<iv>.<ciphertext>

const result = await SessionToken.unseal(token);
if (!result.ok) console.log(result.code); // expired, purpose_mismatch, ...
else console.log(result.payload.userId);
```

Helpers: `unsealOrThrow()`, `unsealOrNull()`, `unsealOnce(token, {store})` for `oneTime:true`, `inspect(token)` for public header.

See [docs/recipes](./docs/recipes/README.md) for password-reset, magic-link, invite, cookie session flows.

## Features

- **AES-GCM + Web Crypto**, random 96-bit IV, AAD-authenticated header
- **Purpose / issuer / audience binding** — prevents token confusion
- **Key rotation** via `kid` — keep old keys until TTL expires
- **TTL strings** `30s`, `15m`, `1h`, `7d` or ms number
- **Hardening:** default `16KB` max token size, strict identifier validation (`kid`/`purpose` 1-128, `issuer`/`audience` 1-256)
- **One-time tokens:** `oneTime:true` + `unsealOnce()` with `memoryReplayStore()`, `cloudflareKVReplayStore()`, `upstashRedisReplayStore()`
- **Cookie helpers:** `serializeCookie`, `getCookie`, `createCookieSession` (`stateless-seal/cookie-session`)
- **TypeScript-first**, Zod-compatible `schema` without hard dependency, zero runtime deps
- **CLI:** `npx stateless-seal keygen|inspect|seal|unseal`

<details>
<summary><b>API summary (click to expand)</b></summary>

```ts
createSealer({ issuer, keys, currentKeyId, maxTokenSize?, clock? })
sealer.defineToken({ purpose, ttl, audience?, schema?, maxTokenSize?, clockTolerance?, notBefore?, oneTime? })

Token.seal(payload, { notBefore? })
Token.unseal(token) -> {ok, payload, meta} | {ok:false, code}
Token.unsealOrThrow(token) -> payload
Token.unsealOrNull(token) -> payload | null
Token.unsealOnce(token, {store}) // for oneTime
Token.inspect(token) -> {version, algorithm, keyId, purpose, issuer, audience}
```
Error codes: `expired`, `not_yet_valid`, `purpose_mismatch`, `issuer_mismatch`, `audience_mismatch`, `unknown_kid`, `decrypt_failed`, `token_too_large`, `schema_validation_failed`, `replayed`, etc. Full list in [docs/error-handling.md](./docs/error-handling.md).

</details>

## Protocol & Docs

| Doc | Purpose |
|---|---|
| [SPEC.md](./SPEC.md) | `stseal.v1` token format |
| [TEST-VECTORS.md](./TEST-VECTORS.md) | compatibility vectors |
| [STABILITY.md](./STABILITY.md) | v1 stability guarantee |
| [THREAT-MODEL.md](./THREAT-MODEL.md) | guarantees / non-goals |
| [SECURITY.md](./SECURITY.md) | vulnerability reporting |
| [docs/key-management.md](./docs/key-management.md) | rotation & storage |
| [docs/cookie-session.md](./docs/cookie-session.md) | edge cookie sessions |
| [docs/replay-protection.md](./docs/replay-protection.md) | one-time guidance |
| [CHANGELOG.md](./CHANGELOG.md) | release history |

Full index in [docs/](./docs/).

## Security Notes

- **Stateless = no per-token revocation** without external state — use short TTL.
- **One-time needs store** — `oneTime:true` requires `unsealOnce()` + shared store (KV/Redis); `memoryReplayStore()` is for single-process only. Reject if store down.
- **Header is plaintext + authenticated** — don't put PII in header, only `kid`/`pur`/`iss`/`aud`.
- **Key handling:** generate strong keys, env/secret manager, rotate periodically, different `issuer` per app.

## When to Use / Not Use

**Use when** you control issuer+consumer, want encrypted short-lived purpose-bound tokens, don't want DB rows.

**Don't use when** you need per-token immediate revocation, OAuth/OIDC interop, public verification, long-lived refresh tokens, or cannot manage keys. Then use JWT/JWE/PASETO.

## License

MIT — see [LICENSE](./LICENSE). Package on npm: [https://www.npmjs.com/package/stateless-seal](https://www.npmjs.com/package/stateless-seal)
