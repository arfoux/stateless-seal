# Stateless Seal v1 Specification

This document specifies the Stateless Seal v1 token format and validation
rules. The npm package may still be pre-1.0, but the token format described
here is the protocol contract for `stseal.v1` tokens.

Stateless Seal creates compact, encrypted, purpose-bound tokens for
application-controlled flows such as password reset, magic links, email
verification, invite links, temporary grants, and session cookies.

## Goals

- Encrypt application payloads by default.
- Bind tokens to an explicit purpose.
- Bind tokens to an issuer and optional audience.
- Support stateless verification.
- Support key rotation through `kid`.
- Run on Web Crypto compatible runtimes.

## Non-Goals

- Public verification by clients.
- OAuth, OIDC, JWT, JWE, or PASETO interoperability.
- Immediate per-token revocation without external state.
- One-time use without a replay store.
- Hiding public header metadata.
- Authorization policy correctness for the application.

## Token Format

A Stateless Seal v1 token has exactly five dot-separated segments:

```txt
stseal.v1.<header>.<iv>.<ciphertext>
```

Segments:

- `stseal`: fixed token prefix.
- `v1`: fixed token format version.
- `<header>`: base64url encoded JSON header.
- `<iv>`: base64url encoded AES-GCM IV.
- `<ciphertext>`: base64url encoded AES-GCM ciphertext and tag.

Implementations MUST reject tokens that do not contain exactly five segments.

## Encoding

All binary token segments use base64url without padding.

Base64url alphabet:

```txt
ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_
```

Implementations MUST reject encoded segments containing characters outside this
alphabet.

JSON values are encoded as UTF-8 before encryption or base64url encoding.

## Header

The header is plaintext JSON. It is not encrypted. It is authenticated by
AES-GCM additional authenticated data.

Header fields:

```json
{
  "alg": "A256GCM",
  "kid": "2026-05",
  "pur": "password-reset",
  "iss": "example-app",
  "aud": "web"
}
```

Fields:

- `alg`: required. MUST be `"A256GCM"`.
- `kid`: required. Key identifier used to select the decryption key.
- `pur`: required. Purpose identifier.
- `iss`: required. Issuer identifier.
- `aud`: optional. Audience identifier.

The header MUST NOT contain sensitive data. It can be decoded by anyone who has
the token.

Reference SDK identifier limits:

- `kid`: 1-128 characters matching `^[A-Za-z0-9._:/@-]+$`
- `pur`: 1-128 characters matching `^[a-z0-9][a-z0-9._:-]{0,127}$`
- `iss`: 1-256 characters matching `^[A-Za-z0-9._:/@-]+$`
- `aud`: 1-256 characters matching `^[A-Za-z0-9._:/@-]+$`

Other implementations SHOULD enforce equivalent length and character limits.

## Body

The body is encrypted JSON.

Body fields:

```json
{
  "iat": 1779340000000,
  "exp": 1779340900000,
  "nbf": 1779340030000,
  "data": {}
}
```

Fields:

- `iat`: required. Issued-at timestamp in milliseconds since Unix epoch.
- `exp`: required. Expiration timestamp in milliseconds since Unix epoch.
- `nbf`: optional. Not-before timestamp in milliseconds since Unix epoch.
- `data`: required. Application payload.

Future protocol extensions may add additional encrypted body fields.
Implementations MUST ignore unknown body fields unless a higher-level policy
requires them.

## Additional Authenticated Data

The AES-GCM additional authenticated data is:

```txt
UTF8("stseal.v1." + headerB64)
```

Where `headerB64` is the exact third segment from the token.

Implementations MUST preserve the exact encoded header segment during
verification. They MUST NOT re-serialize the parsed header to compute AAD.

This means v1 verification does not require canonical JSON. Producers MAY emit
JSON fields in any order, but verifiers MUST authenticate the exact header
segment present in the token.

## Encryption

Algorithm:

- AES-256-GCM
- 256-bit symmetric key
- 96-bit random IV
- 128-bit authentication tag

The `<ciphertext>` segment contains the encrypted body plus the 128-bit GCM tag
as returned by Web Crypto AES-GCM.

Each sealed token MUST use a fresh random 96-bit IV for the selected key.
Implementations MUST reject tokens whose decoded IV is not exactly 12 bytes.

## Key Format

String keys are 32-byte base64url values without padding.

The reference SDK also accepts raw `Uint8Array` keys and Web Crypto `CryptoKey`
objects. Protocol implementations only need the raw 32-byte AES-GCM key.

Reference SDK `CryptoKey` inputs must be secret AES-GCM keys. A key used for
sealing must allow `encrypt`; a key used for unsealing must allow `decrypt`.

## Token Size

The reference SDK rejects tokens larger than `16 * 1024` bytes by default before
parsing or decrypting. Applications may configure a smaller sealer-level or
policy-level limit for sensitive flows.

Policy-level limits MUST NOT exceed the sealer-level limit.

## Sealing Procedure

Given:

- issuer `iss`
- purpose `pur`
- optional audience `aud`
- current key id `kid`
- 32-byte AES-GCM key
- current time `now`
- ttl in milliseconds
- optional not-before delay
- application payload `data`

Producer steps:

1. Construct the header JSON with `alg`, `kid`, `pur`, `iss`, and optional `aud`.
2. Base64url encode the UTF-8 header JSON as `headerB64`.
3. Construct the encrypted body with `iat`, `exp`, optional `nbf`, and `data`.
4. Encode the body JSON as UTF-8.
5. Generate a fresh 12-byte random IV.
6. Compute AAD as `UTF8("stseal.v1." + headerB64)`.
7. Encrypt the body with AES-256-GCM using the selected key, IV, AAD, and a
   128-bit tag.
8. Base64url encode the IV and ciphertext.
9. Return `stseal.v1.<headerB64>.<ivB64>.<ciphertextB64>`.

## Verification Procedure

Given:

- token string
- expected issuer
- expected purpose
- optional expected audience
- keyring indexed by `kid`
- current time
- optional clock tolerance

Verifier steps:

1. Split the token into exactly five segments.
2. Verify prefix is `stseal` and version is `v1`.
3. Decode and parse the header JSON.
4. Verify `alg` is `A256GCM`.
5. Verify `pur` matches the expected purpose.
6. Verify `iss` matches the expected issuer.
7. If an expected audience is configured, verify `aud` matches it.
8. Look up the key by `kid`.
9. Decode IV and ciphertext.
10. Verify IV length is 12 bytes.
11. Compute AAD using the exact encoded header segment from the token.
12. Decrypt with AES-256-GCM.
13. Parse the decrypted body JSON.
14. Verify `exp` is a number and the token is not expired.
15. If `nbf` is present, verify it is a number and the token is active.
16. Return the application payload from `data`.

Clock tolerance applies to both `exp` and `nbf`:

- Expiration check: `now - clockTolerance <= exp`
- Not-before check: `now + clockTolerance >= nbf`

## Audience Semantics

Audience is optional. If a verifier configures an expected audience, the token
header MUST contain the same audience. If a verifier does not configure an
audience, audience is not enforced by the v1 reference SDK.

Applications SHOULD configure `aud` for flows where audience separation
matters.

## Error Handling

Implementations SHOULD distinguish developer-facing rejection reasons, but
applications SHOULD NOT expose detailed token rejection codes to untrusted
clients.

The reference SDK includes rejection codes for malformed tokens, unsupported
algorithms, unknown key ids, invalid keys, failed decryption, expired tokens,
not-yet-valid tokens, token size limits, schema validation failures, and binding
mismatches.

Recommended public response:

```txt
Invalid token
```

Recommended internal log fields:

```json
{
  "event": "stateless_seal_rejected",
  "code": "expired"
}
```

## Security Notes

- AES-GCM authenticates the header through AAD but does not encrypt it.
- A valid token can be replayed until it expires unless replay protection is
  added by the application or a future SDK extension.
- Token size should be bounded by applications to limit resource abuse.
- The reference SDK applies a default 16 KiB token size limit.
- Keys must be generated with sufficient entropy and rotated carefully.
- Do not reuse a key for unrelated protocols.

## Compatibility

The v1 protocol is designed for Web Crypto compatible runtimes, including:

- Cloudflare Workers
- Vercel Edge
- Deno
- Bun
- Node.js 18+
- modern browsers with Web Crypto
