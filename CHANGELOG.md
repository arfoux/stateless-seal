# Changelog

## 0.8.0

- Add key management guidance.
- Add production error handling guidance.
- Add production deployment checklist.
- Document public vs server-side token rejection handling.
- Document key rotation and emergency key removal guidance.

## 0.7.0

- Add `stateless-seal` CLI binary.
- Add `stateless-seal keygen`.
- Add `stateless-seal inspect <token>` for unverified public metadata.
- Add `--json` output for token inspection.
- Add CLI docs and test coverage.

## 0.6.0

- Add official recipe docs for password reset, magic links, email
  verification, invite links, temporary download grants, and session cookies.
- Add recipe index under `docs/recipes/`.
- Add framework-agnostic password reset and session cookie examples.
- Document production usage guidance for purpose separation, short TTLs,
  replay stores, and request-context checks.

## 0.5.0

- Add `stateless-seal/cookie-session` subpath export.
- Add `createCookieSession()` for framework-agnostic sealed session cookies.
- Add secure cookie defaults for session commits and clears.
- Add cookie session docs and test coverage.

## 0.4.0

- Add `stateless-seal/testing` subpath export.
- Add `createTestClock()` for expiry, `nbf`, and replay tests.
- Add `createTestSealer()` with stable test defaults.
- Add testing helper docs and test coverage.
- Add opt-in debug logs across the internal test suite.

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
