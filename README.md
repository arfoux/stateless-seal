# stateless-seal

Encrypted, purpose-bound, stateless tokens for JavaScript runtimes.

Use it when your app needs a short-lived private token: password reset, magic
links, email verification, invite links, temporary grants, session cookies, and
internal handoff tokens.

Stateless Seal creates compact AES-GCM sealed tokens with explicit purpose,
issuer, audience, expiry, and key rotation.

A token sealed for `password-reset` cannot be opened as `session`. A token
sealed for `web` cannot be opened as `api`. The payload is encrypted, not just
signed.

```ts
import { createSealer } from "stateless-seal";

const sealer = createSealer({
  issuer: "my-app",
  keys: {
    "2026-05": process.env.SEAL_KEY_2026_05!
  },
  currentKeyId: "2026-05"
});

const PasswordResetToken = sealer.defineToken<{ userId: string }>({
  purpose: "password-reset",
  ttl: "15m",
  audience: "web"
});

const token = await PasswordResetToken.seal({
  userId: "user_123"
});

const result = await PasswordResetToken.unseal(token);

if (result.ok) {
  console.log(result.payload.userId);
} else {
  console.log(result.code);
}
```

---

## Why?

Sometimes you do not need a database row, a JWT claim set, or a full authentication framework.

Sometimes you just need a token that says:

- this payload is encrypted
- this token is only for one specific purpose
- this token is only valid for this app
- this token is only valid for this audience
- this token expires soon
- this token can be verified without a database lookup

That is what `stateless-seal` is for.

---

## What can it be used for?

`stateless-seal` can be used for short-lived encrypted tokens such as:

- password reset tokens
- email verification tokens
- magic links
- invite links
- temporary download grants
- session cookies
- internal handoff tokens
- one-step encrypted capability tokens

Example:

```ts
const PasswordResetToken = sealer.defineToken({
  purpose: "password-reset",
  ttl: "15m",
  audience: "web"
});

const EmailVerificationToken = sealer.defineToken({
  purpose: "email-verification",
  ttl: "24h",
  audience: "web"
});

const SessionToken = sealer.defineToken({
  purpose: "session",
  ttl: "1h",
  audience: "web"
});
```

A token created for `password-reset` cannot be accepted as a `session` token.

See [docs/recipes](./docs/recipes/README.md) for full flow examples.

---

## Installation

```bash
npm install stateless-seal
```

---

## Requirements

`stateless-seal` uses the Web Crypto API.

## Edge runtime support

`stateless-seal` core is designed to run on Web Crypto based runtimes.

The core does not depend on Node.js runtime APIs such as `crypto`, `fs`, `path`, `os`, or `Buffer`.

Supported targets include:

- Cloudflare Workers
- Vercel Edge
- Deno
- Bun
- Node.js 18+
- modern browsers with Web Crypto

---

## Hardening defaults

The SDK rejects unusually large tokens by default before parsing or decrypting.
The default limit is `16 * 1024` bytes.

Identifiers are intentionally constrained:

- `kid`: 1-128 safe identifier characters
- `purpose`: 1-128 lowercase safe identifier characters
- `issuer`: 1-256 safe identifier characters
- `audience`: 1-256 safe identifier characters

Safe identifier characters are ASCII letters, digits, `.`, `_`, `:`, `/`, `@`,
and `-`. Purpose values must start with a lowercase letter or digit and may use
lowercase letters, digits, `.`, `_`, `:`, and `-`.

These limits are guardrails for logs, headers, and edge runtimes.

---

## Protocol and security docs

`stateless-seal` is maintained as a small SDK plus a documented token format.

- [SPEC.md](./SPEC.md) - Stateless Seal v1 token format
- [TEST-VECTORS.md](./TEST-VECTORS.md) - official compatibility vectors
- [THREAT-MODEL.md](./THREAT-MODEL.md) - guarantees, assumptions, and non-goals
- [SECURITY.md](./SECURITY.md) - vulnerability reporting and security scope
- [docs/cli.md](./docs/cli.md) - keygen and unverified inspect CLI
- [docs/key-management.md](./docs/key-management.md) - key generation, storage, and rotation
- [docs/error-handling.md](./docs/error-handling.md) - safe public and server-side errors
- [docs/production-checklist.md](./docs/production-checklist.md) - production deployment checklist
- [docs/replay-protection.md](./docs/replay-protection.md) - one-time token guidance
- [docs/cloudflare-workers.md](./docs/cloudflare-workers.md) - Workers KV replay store recipe
- [docs/cookie-session.md](./docs/cookie-session.md) - framework-agnostic cookie sessions
- [docs/testing.md](./docs/testing.md) - test clock and test sealer helpers
- [docs/recipes](./docs/recipes/README.md) - password reset, magic link, invite, download, and session recipes
- [CHANGELOG.md](./CHANGELOG.md) - release history

---

## Quick start

### 1. Generate a key

With the CLI:

```bash
npx stateless-seal keygen
```

Or from code:

```ts
import { generateSealKey } from "stateless-seal";

console.log(generateSealKey());
```

Store the generated key in your environment variable.

Example:

```env
SEAL_KEY_2026_05="your-generated-32-byte-base64url-key"
```

Do not hardcode production keys.

---

### 2. Create a sealer

```ts
import { createSealer } from "stateless-seal";

const sealer = createSealer({
  issuer: "my-app",
  keys: {
    "2026-05": process.env.SEAL_KEY_2026_05!
  },
  currentKeyId: "2026-05"
});
```

---

### 3. Define a token policy

```ts
const PasswordResetToken = sealer.defineToken<{ userId: string }>({
  purpose: "password-reset",
  ttl: "15m",
  audience: "web"
});
```

---

### 4. Seal a payload

```ts
const token = await PasswordResetToken.seal({
  userId: "user_123"
});
```

The output is a compact sealed token:

```txt
stseal.v1.<header>.<iv>.<ciphertext>
```

---

### 5. Unseal the token

```ts
const result = await PasswordResetToken.unseal(token);

if (!result.ok) {
  console.log("Invalid token:", result.code);
} else {
  console.log(result.payload.userId);
}
```

---

## API

### `createSealer(config)`

Creates a sealer instance.

```ts
const sealer = createSealer({
  issuer: "my-app",
  keys: {
    "2026-05": process.env.SEAL_KEY_2026_05!,
    "2026-04": process.env.SEAL_KEY_2026_04!
  },
  currentKeyId: "2026-05"
});
```

Config:

```ts
type SealerConfig = {
  issuer: string;
  keys: Record<string, string | Uint8Array | CryptoKey>;
  currentKeyId: string;
  maxTokenSize?: number;
  clock?: () => number;
};
```

`maxTokenSize` defaults to `16 * 1024` bytes. Token policies may set a smaller
limit for sensitive flows, but they cannot exceed the sealer-level limit.

### `sealer.defineToken(policy)`

Defines a purpose-bound token.

```ts
const SessionToken = sealer.defineToken<{ userId: string; role: string }>({
  purpose: "session",
  ttl: "1h",
  audience: "web"
});
```

Policy:

```ts
type TokenPolicy = {
  purpose: string;
  ttl: string | number;
  audience?: string;
  schema?: TokenSchema<TPayload>;
  maxTokenSize?: number;
  clockTolerance?: string | number;
  notBefore?: string | number;
  oneTime?: boolean;
};
```

Supported TTL strings:

```txt
ms
s
m
h
d
```

Examples:

```ts
ttl: "30s"
ttl: "15m"
ttl: "1h"
ttl: "7d"
ttl: 60000
```

Additional policy options:

- `schema` validates payloads while sealing and after decrypting
- `maxTokenSize` rejects oversized tokens before parsing or decrypting; it must
  be less than or equal to the sealer limit
- `clockTolerance` allows small clock skew for `exp` and `nbf`
- `notBefore` sets a default relative activation delay for newly sealed tokens
- `oneTime` adds an encrypted `jti` and requires `unsealOnce()` with a replay store

`schema` is structural. Zod-style schemas work without making Zod a required dependency:

```ts
const SessionToken = sealer.defineToken({
  purpose: "session",
  ttl: "1h",
  audience: "web",
  schema: z.object({
    userId: z.string(),
    role: z.enum(["user", "admin"])
  })
});
```

---

## Token methods

### `Token.seal(payload, options?)`

Encrypts and seals a payload.

```ts
const token = await SessionToken.seal({
  userId: "user_123",
  role: "admin"
});
```

Use `notBefore` when a token should not be accepted immediately:

```ts
const token = await SessionToken.seal(
  { userId: "user_123" },
  { notBefore: "30s" }
);
```

---

### `Token.unseal(token)`

Verifies, decrypts, and returns a Result object.

```ts
const result = await SessionToken.unseal(token);

if (result.ok) {
  console.log(result.payload);
} else {
  console.log(result.code);
}
```

Result type:

```ts
type UnsealResult<TPayload> =
  | {
      ok: true;
      payload: TPayload;
      meta: TokenMeta;
    }
  | {
      ok: false;
      code: SealErrorCode;
    };
```

Possible error codes:

```txt
invalid_config
invalid_policy
invalid_options
invalid_key
malformed_token
unsupported_version
unsupported_algorithm
unknown_kid
decrypt_failed
expired
not_yet_valid
token_too_large
schema_validation_failed
replay_required
missing_jti
replayed
replay_store_failed
purpose_mismatch
issuer_mismatch
audience_mismatch
```

---

### `Token.unsealOrThrow(token)`

Like `unseal()`, but throws a `SealError` if the token is invalid.

```ts
const payload = await SessionToken.unsealOrThrow(token);
```

---

### `Token.unsealOrNull(token)`

Like `unseal()`, but returns `null` instead of a Result object when the token is invalid.

```ts
const payload = await SessionToken.unsealOrNull(token);

if (!payload) {
  // reject request
}
```

---

### `Token.unsealOnce(token, { store })`

Verifies, decrypts, and consumes a one-time token through a replay store.

```ts
import { memoryReplayStore } from "stateless-seal";

const MagicLinkToken = sealer.defineToken<{ userId: string }>({
  purpose: "magic-link",
  ttl: "10m",
  audience: "web",
  oneTime: true
});

const store = memoryReplayStore();
const result = await MagicLinkToken.unsealOnce(token, { store });

if (!result.ok) {
  console.log(result.code);
}
```

For policies with `oneTime: true`, plain `unseal()` returns
`replay_required`. Use `unsealOnce()` so the token id is consumed before the
payload is accepted.

`memoryReplayStore()` is intended for tests, local development, and
single-process demos. Production multi-instance apps should use a shared store.

Cloudflare Workers can use the subpath adapter:

```ts
import { cloudflareKVReplayStore } from "stateless-seal/cloudflare";

const result = await MagicLinkToken.unsealOnce(token, {
  store: cloudflareKVReplayStore(env.REPLAY_KV)
});
```

---

## Testing helpers

Testing helpers are available from the `stateless-seal/testing` subpath.

```ts
import { createTestSealer } from "stateless-seal/testing";

const { sealer, clock } = createTestSealer({
  issuer: "test-app",
  now: 1000
});

const SessionToken = sealer.defineToken<{ userId: string }>({
  purpose: "session",
  ttl: "10s"
});

const token = await SessionToken.seal({
  userId: "user_123"
});

await SessionToken.unseal(token);

clock.advance("11s");

const expired = await SessionToken.unseal(token);
```

Use these helpers for application tests and examples. Do not use the exported
test key in production.

See [docs/testing.md](./docs/testing.md).

---

### `Token.inspect(token)`

Reads public token metadata without decrypting the payload.

```ts
const meta = SessionToken.inspect(token);

console.log(meta);
```

Example output:

```ts
{
  version: "v1",
  algorithm: "A256GCM",
  keyId: "2026-05",
  purpose: "session",
  issuer: "my-app",
  audience: "web"
}
```

`inspect()` does not prove that the token is valid.  
Use `unseal()` to verify and decrypt the token.

---

## Cookie helpers

Cookie helpers are small, dependency-free utilities for edge runtimes.

```ts
import {
  clearCookie,
  getCookie,
  parseCookies,
  serializeCookie
} from "stateless-seal";
```

```ts
const header = serializeCookie("session", token, {
  httpOnly: true,
  secure: true,
  sameSite: "Strict",
  path: "/",
  maxAge: 3600
});

const tokenFromCookie = getCookie(request.headers.get("Cookie"), "session");
```

`maxAge` is expressed in seconds, following the `Set-Cookie` `Max-Age` attribute.

---

## Cookie sessions

Cookie session helpers are available from the `stateless-seal/cookie-session`
subpath.

```ts
import { createCookieSession } from "stateless-seal/cookie-session";

const SessionToken = sealer.defineToken<{ userId: string }>({
  purpose: "session",
  ttl: "1h",
  audience: "web"
});

const session = createCookieSession({
  token: SessionToken,
  cookieName: "__Host-session"
});

const setCookie = await session.commit({
  userId: "user_123"
});

const result = await session.read(request);

if (!result.ok) {
  return new Response("Unauthorized", { status: 401 });
}
```

`createCookieSession()` defaults to `HttpOnly`, `Secure`, `SameSite=Lax`, and
`Path=/`. It accepts raw `Cookie` headers, `Headers`-like objects, and
request-like objects with `.headers`.

See [docs/cookie-session.md](./docs/cookie-session.md).

---

## Token format

`stateless-seal` uses this v1 token format:

```txt
stseal.v1.<header>.<iv>.<ciphertext>
```

### Header

The header is plaintext, but authenticated with AES-GCM additional authenticated data.

Example header:

```json
{
  "alg": "A256GCM",
  "kid": "2026-05",
  "pur": "password-reset",
  "iss": "my-app",
  "aud": "web"
}
```

The header is not secret.

Do not put sensitive data in the header.

Good header data:

```json
{
  "kid": "2026-05",
  "pur": "password-reset",
  "iss": "my-app",
  "aud": "web"
}
```

Bad header data:

```json
{
  "email": "user@example.com",
  "userId": "user_123"
}
```

Sensitive data belongs inside the encrypted payload.

---

### Encrypted body

The encrypted body contains internal claims and your payload:

```json
{
  "iat": 1779340000000,
  "exp": 1779340900000,
  "nbf": 1779340030000,
  "data": {
    "userId": "user_123"
  }
}
```

Fields:

- `iat` - issued-at timestamp in milliseconds
- `exp` - expiration timestamp in milliseconds
- `nbf` - optional not-before timestamp in milliseconds
- `data` - your encrypted payload

`nbf` is present only when `notBefore` is configured in the policy or passed to `Token.seal()`.

---

## Purpose binding

Purpose binding is the main idea of `stateless-seal`.

A token created for one purpose should not be accepted for another purpose.

```ts
const SessionToken = sealer.defineToken({
  purpose: "session",
  ttl: "1h",
  audience: "web"
});

const PasswordResetToken = sealer.defineToken({
  purpose: "password-reset",
  ttl: "15m",
  audience: "web"
});

const token = await PasswordResetToken.seal({
  userId: "user_123"
});

const result = await SessionToken.unseal(token);

console.log(result.ok); 
// false
```

This prevents accidental token confusion between different flows.

---

## Audience and issuer binding

Each token is bound to:

- `issuer`
- `audience`
- `purpose`
- `key id`

Example:

```ts
const WebSessionToken = sealer.defineToken({
  purpose: "session",
  ttl: "1h",
  audience: "web"
});

const ApiSessionToken = sealer.defineToken({
  purpose: "session",
  ttl: "1h",
  audience: "api"
});
```

A token for `web` will not be accepted as a token for `api`.

---

## Key rotation

`stateless-seal` supports key rotation with `kid`.

```ts
const sealer = createSealer({
  issuer: "my-app",
  keys: {
    "2026-05": process.env.SEAL_KEY_2026_05!,
    "2026-04": process.env.SEAL_KEY_2026_04!
  },
  currentKeyId: "2026-05"
});
```

New tokens are sealed with `currentKeyId`.

Old tokens can still be unsealed as long as their key remains in the keyring.

To rotate keys:

1. Add the new key to `keys`.
2. Set `currentKeyId` to the new key.
3. Keep the old key until old tokens expire.
4. Remove the old key after the maximum TTL window.

Example:

```ts
const sealer = createSealer({
  issuer: "my-app",
  keys: {
    "2026-06": process.env.SEAL_KEY_2026_06!,
    "2026-05": process.env.SEAL_KEY_2026_05!
  },
  currentKeyId: "2026-06"
});
```

---

## Security model

`stateless-seal` provides:

- payload confidentiality
- payload integrity
- token tamper detection
- purpose binding
- issuer binding
- audience binding
- key rotation support
- expiration checking
- optional one-time replay protection with a replay store

It uses:

- AES-GCM
- Web Crypto API
- random 96-bit IV per token
- authenticated plaintext header through AAD
- encrypted JSON payload body

---

## Important security notes

### Tokens are stateless

No token is stored on the server by default.

This means issued tokens cannot be individually revoked without external state.

Use short TTLs.

---

### One-time tokens need a replay store

AES-GCM prevents tampering.  
It does not prevent a valid bearer token from being reused by itself.

For password reset links, magic links, or one-time flows, use `oneTime: true`,
short TTLs, and `unsealOnce()` with a replay store.

If the replay store is unavailable, reject the token. Accepting tokens while the
store is down silently disables one-time guarantees.

---

### Header is visible

The token header is plaintext.

This is expected.

The header is used for key lookup, purpose checks, issuer checks, and audience checks.

The header is authenticated, but not encrypted.

---

### Key management matters

If your key leaks, issued tokens should be considered compromised.

Recommended:

- use strong generated keys
- store keys in environment variables or secret managers
- rotate keys periodically
- use different issuers/projects for different apps
- keep TTL short for sensitive flows

---

## When to use this

Use `stateless-seal` when:

- you control both token issuer and token consumer
- you want encrypted payloads
- you want short-lived tokens
- you want purpose-bound token policies
- you do not need third-party token interoperability
- you do not want to store token payloads in a database
- you want one primitive for many app flows

Good use cases:

```txt
password reset
email verification
magic link
invite link
temporary download access
session cookie
internal encrypted handoff
```

---

## When not to use this

Do not use this if:

- you need immediate per-token revocation without external state
- you need OAuth/OIDC compatibility
- you need third-party interoperability
- you need public verification by clients
- you need long-lived refresh tokens
- you want a standardized token format like JWE or PASETO
- you cannot safely manage encryption keys

---

## Comparison

### Compared to JWT

JWT payloads are commonly readable by clients unless encrypted with JWE.

`stateless-seal` encrypts payloads by default.

Use JWT when you need ecosystem compatibility, public claims, or standard authorization flows.

Use `stateless-seal` when you control both sides and want encrypted, purpose-bound, short-lived tokens.

---

### Compared to JWE

JWE is a standard encrypted token format.

`stateless-seal` is not trying to replace JWE.

Use JWE when you need standards-based interoperability.

Use `stateless-seal` when you want a small, opinionated, JavaScript-first API for purpose-bound sealed tokens.

---

### Compared to PASETO local

PASETO is a well-designed token protocol.

`stateless-seal` is not claiming to be more secure than PASETO.

Use PASETO when you want a mature token protocol.

Use `stateless-seal` when you want policy-based token definitions, Web Crypto compatibility, and a minimal JS-native developer experience.

---

### Compared to iron-session

iron-session focuses on stateless encrypted sessions/cookies.

`stateless-seal` is more general-purpose.

Use iron-session for cookie session management.

Use `stateless-seal` for password reset tokens, invite links, email verification, magic links, temporary grants, and session cookies using the same primitive.

---

## Example: password reset

```ts
import { memoryReplayStore } from "stateless-seal";

const PasswordResetToken = sealer.defineToken<{ userId: string }>({
  purpose: "password-reset",
  ttl: "15m",
  audience: "web",
  oneTime: true
});

// Replace with a shared production replay store in multi-instance apps.
const replayStore = memoryReplayStore();

export async function createPasswordResetLink(userId: string) {
  const token = await PasswordResetToken.seal({ userId });

  return `https://example.com/reset-password?token=${token}`;
}

export async function verifyPasswordResetToken(token: string) {
  const result = await PasswordResetToken.unsealOnce(token, {
    store: replayStore
  });

  if (!result.ok) {
    return null;
  }

  return result.payload.userId;
}
```

---

## Example: email verification

```ts
const EmailVerificationToken = sealer.defineToken<{
  userId: string;
  email: string;
}>({
  purpose: "email-verification",
  ttl: "24h",
  audience: "web"
});

const token = await EmailVerificationToken.seal({
  userId: "user_123",
  email: "user@example.com"
});

const result = await EmailVerificationToken.unseal(token);

if (result.ok) {
  console.log(result.payload.email);
}
```

---

## Example: session cookie

```ts
const SessionToken = sealer.defineToken<{
  userId: string;
  role: "user" | "admin";
}>({
  purpose: "session",
  ttl: "1h",
  audience: "web"
});

const token = await SessionToken.seal({
  userId: "user_123",
  role: "admin"
});
```

Set it as an HTTP-only cookie with the edge-safe helper:

```ts
import { getCookie, serializeCookie } from "stateless-seal";

const setCookie = serializeCookie("session", token, {
  httpOnly: true,
  secure: true,
  sameSite: "Strict",
  path: "/",
  maxAge: 60 * 60
});
```

Then unseal it on each request:

```ts
const tokenFromCookie = getCookie(request.headers.get("Cookie"), "session");

if (!tokenFromCookie) {
  throw new Error("Missing session cookie.");
}

const result = await SessionToken.unseal(tokenFromCookie);

if (!result.ok) {
  // reject request
}

if (result.ok) {
  console.log(result.payload.userId);
}
```

---

## TypeScript

`stateless-seal` is TypeScript-first.

```ts
const InviteToken = sealer.defineToken<{
  teamId: string;
  role: "admin" | "member";
}>({
  purpose: "team-invite",
  ttl: "7d",
  audience: "web"
});

const token = await InviteToken.seal({
  teamId: "team_123",
  role: "admin"
});

const result = await InviteToken.unseal(token);

if (result.ok) {
  result.payload.role;
  // typed as "admin" | "member"
}
```

Schemas can also drive the payload type:

```ts
const SessionToken = sealer.defineToken({
  purpose: "session",
  ttl: "1h",
  schema: {
    parse(input: unknown): { userId: string } {
      if (
        !input ||
        typeof input !== "object" ||
        typeof (input as { userId?: unknown }).userId !== "string"
      ) {
        throw new Error("Invalid payload.");
      }

      return {
        userId: (input as { userId: string }).userId
      };
    }
  }
});

const payload = await SessionToken.unsealOrThrow(token);
payload.userId;
```

---

## Current status

This is v0.8.0.

Included:

- `createSealer()`
- `defineToken()`
- `Token.seal()`
- `Token.unseal()`
- `Token.unsealOnce()`
- `Token.unsealOrThrow()`
- `Token.unsealOrNull()`
- `Token.inspect()`
- schema validation
- Zod-compatible schema support without a required Zod dependency
- `maxTokenSize`
- default global token size limit
- strict identifier validation
- explicit `invalid_key` handling
- `clockTolerance`
- `notBefore` / encrypted `nbf`
- `oneTime` / encrypted `jti`
- `ReplayStore`
- `memoryReplayStore()`
- `cloudflareKVReplayStore()`
- `createTestClock()`
- `createTestSealer()`
- `createCookieSession()`
- official recipes
- key management guidance
- production checklist
- error handling guidance
- CLI `keygen`
- CLI `inspect`
- edge-safe cookie helpers
- AES-GCM encryption
- Web Crypto API
- purpose binding
- issuer binding
- audience binding
- key rotation with `kid`
- TTL and expiration
- TypeScript types
- zero runtime dependencies

Not included yet:

- Redis/Upstash replay store
- strongly consistent Cloudflare Durable Object replay store
- refresh token flow
- CLI `seal` / `unseal` commands

---

## Roadmap

### v0.1

Core sealed token engine.

- AES-GCM Web Crypto
- purpose-bound policies
- key rotation
- result-based unseal
- TypeScript support

### v0.2

Developer experience.

- schema validation
- Zod-compatible schema support
- cookie helper
- `unsealOrNull()`
- `clockTolerance`
- `notBefore` / `nbf`
- stricter token size controls

### v0.3

One-time token flows.

- encrypted `jti`
- `oneTime` token policy
- `ReplayStore` interface
- `Token.unsealOnce()`
- `memoryReplayStore()`
- Cloudflare Workers KV replay store

### v0.4

Testing and application DX.

- `stateless-seal/testing` subpath
- `createTestClock()`
- `createTestSealer()`

### v0.5

Cookie session DX.

- `stateless-seal/cookie-session` subpath
- `createCookieSession()`
- framework-agnostic session cookie helper

### v0.6

Recipes and production guidance.

- password reset recipe
- magic link recipe
- email verification recipe
- invite link recipe
- temporary download grant recipe
- session cookie recipe

### v0.7

CLI basics.

- `stateless-seal keygen`
- `stateless-seal inspect`

### v0.8

Production readiness docs.

- key management guide
- error handling guide
- production checklist

### v1.0

Stable production API.

- Redis/Upstash adapter
- strongly consistent Cloudflare Durable Object replay store
- stable token format guarantee
- production API freeze

---

## License

MIT
