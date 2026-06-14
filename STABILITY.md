# Stability Policy

`stateless-seal` v1.0.0 freezes the Stateless Seal v1 token format and the
current public SDK surface.

The goal is boring compatibility: tokens sealed by one compatible v1
implementation should remain verifiable by another compatible v1
implementation when the same keys and policy inputs are used.

---

## Stable In v1

The following are stable for the v1 line:

- token prefix: `stseal`
- token format version: `v1`
- token shape: `stseal.v1.<header>.<iv>.<ciphertext>`
- header fields: `alg`, `kid`, `pur`, `iss`, optional `aud`
- encrypted body fields: `iat`, `exp`, optional `nbf`, optional `jti`, `data`
- AES-256-GCM encryption with 96-bit IVs
- AAD construction: `UTF8("stseal.v1." + headerB64)`
- base64url without padding
- purpose, issuer, audience, expiry, and not-before validation semantics
- `ReplayStore` one-time consumption contract
- public subpath exports:
  - `stateless-seal`
  - `stateless-seal/cloudflare`
  - `stateless-seal/testing`
  - `stateless-seal/cookie-session`
- CLI commands:
  - `stateless-seal keygen`
  - `stateless-seal inspect`
  - `stateless-seal version`

---

## Compatible Changes

Minor and patch releases may add:

- new helper APIs
- new subpath exports
- new replay store adapters
- new recipes and examples
- stricter validation for malformed or unsafe inputs
- new error codes for new optional features
- documentation and test vector additions
- CI/runtime coverage

These changes should not require existing valid `stseal.v1` tokens to be
reissued.

---

## Breaking Changes

The following require a major version or a new token format version:

- changing the token segment layout
- changing AAD construction
- changing the encryption algorithm for `stseal.v1`
- changing required header or encrypted body semantics
- removing or renaming stable public APIs
- removing stable subpath exports
- changing existing error code meanings
- accepting tokens that v1 requires implementations to reject

If a future protocol needs incompatible behavior, it should use a new format
version such as `stseal.v2`.

---

## Test Vectors

The v1 test vectors are part of the compatibility contract.

Implementations should use `TEST-VECTORS.md` and `test-vectors/v1/` to confirm
that they:

- accept valid vectors
- reject invalid vectors
- compute AAD from the exact encoded header segment
- do not require canonical JSON during verification

---

## Security Fixes

Security fixes may intentionally reject tokens that were previously accepted if
the old behavior was unsafe or outside the v1 specification.

Such changes should be documented in the changelog and, when appropriate, in
`SECURITY.md`.
