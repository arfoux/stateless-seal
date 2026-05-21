# stateless-seal

Purpose-bound sealed tokens for JavaScript.

`stateless-seal` is a small, runtime-friendly sealed token engine for creating encrypted, tamper-proof, short-lived tokens with explicit purpose, issuer, audience, expiry, and key rotation.

It is not a JWT replacement.  
It is not a new token standard.  
It is not just a session library.

It is a practical encrypted token primitive for JavaScript apps.

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

---

## Installation

```bash
npm install stateless-seal
```

---

## Requirements

`stateless-seal` uses the Web Crypto API.

Supported runtimes:

- Node.js 18+
- Bun
- Deno
- Cloudflare Workers
- Vercel Edge
- modern browsers with Web Crypto support

---

## Quick start

### 1. Generate a key

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
  clock?: () => number;
};
```

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

---

## Token methods

### `Token.seal(payload)`

Encrypts and seals a payload.

```ts
const token = await SessionToken.seal({
  userId: "user_123",
  role: "admin"
});
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
malformed_token
unsupported_version
unsupported_algorithm
unknown_kid
decrypt_failed
expired
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

## Token format

`stateless-seal` v0.1 uses this format:

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
  "data": {
    "userId": "user_123"
  }
}
```

Fields:

- `iat` — issued-at timestamp in milliseconds
- `exp` — expiration timestamp in milliseconds
- `data` — your encrypted payload

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

### Replay is possible within the token lifetime

AES-GCM prevents tampering.  
It does not prevent a valid token from being reused.

For password reset links, magic links, or one-time flows, use short TTLs.

Built-in replay protection is planned for a future version.

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
const PasswordResetToken = sealer.defineToken<{ userId: string }>({
  purpose: "password-reset",
  ttl: "15m",
  audience: "web"
});

export async function createPasswordResetLink(userId: string) {
  const token = await PasswordResetToken.seal({ userId });

  return `https://example.com/reset-password?token=${token}`;
}

export async function verifyPasswordResetToken(token: string) {
  const result = await PasswordResetToken.unseal(token);

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

Set it as an HTTP-only cookie:

```txt
Set-Cookie: session=<token>; HttpOnly; Secure; SameSite=Strict; Path=/
```

Then unseal it on each request:

```ts
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

---

## Current status

This is v0.1.

Included:

- `createSealer()`
- `defineToken()`
- `Token.seal()`
- `Token.unseal()`
- `Token.unsealOrThrow()`
- `Token.inspect()`
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

- schema validation
- Zod adapter
- replay protection
- Redis/Upstash replay store
- cookie helper
- refresh token flow
- CLI

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
- Zod-compatible adapter
- cookie helper
- `unsealOrNull()`
- better examples
- stricter token size controls

### v1.0

Stable production API.

- replay protection interface
- one-time token support
- Redis/Upstash adapter
- complete threat model
- stable token format guarantee
- production checklist

---

## License

MIT