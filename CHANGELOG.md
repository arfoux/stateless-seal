# Changelog

## 0.3.1

- Add `stateless-seal/cloudflare` subpath export.
- Add `cloudflareKVReplayStore()` for Cloudflare Workers KV replay markers.
- Add Workers KV replay store tests with a KV-like fake.
- Add Cloudflare Workers one-time token recipe.
- Include Cloudflare replay store guidance in docs.
- Clamp Workers KV replay marker TTLs to the KV minimum.

## 0.3.0

- Add one-time token policies with encrypted `jti`.
- Add `Token.unsealOnce(token, { store })`.
- Add `ReplayStore` interface.
- Add `memoryReplayStore()` for tests, local development, and single-process demos.
- Add replay-specific error codes: `replay_required`, `missing_jti`, `replayed`,
  and `replay_store_failed`.
- Add replay protection docs and a v1 `jti` test vector.

## 0.2.1

- Add default global token size limit.
- Add stricter identifier validation for issuer, key id, purpose, and audience.
- Add explicit `invalid_key` handling.
- Add malformed token tests and key handling hardening.

## 0.2.0

- Add `Token.unsealOrNull()`.
- Add schema validation and Zod-compatible schema support.
- Add `maxTokenSize`.
- Add `clockTolerance`.
- Add `notBefore` / encrypted `nbf`.
- Add edge-safe cookie helpers.

## 0.1.x

- Initial purpose-bound sealed token engine.
- AES-GCM Web Crypto implementation.
- Token format `stseal.v1.<header>.<iv>.<ciphertext>`.
- Purpose, issuer, and audience binding.
- Key rotation through `kid`.
- Edge runtime compatibility hardening.
