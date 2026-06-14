# Migration Guide

## v0.9.x to v1.0.0

No token migration is required.

`stateless-seal` v1.0.0 uses the same `stseal.v1` token format as v0.9.x. A
token sealed by v0.9.x remains compatible with v1.0.0 when the same issuer,
purpose, audience, keys, and policy settings are used.

---

## Recommended Upgrade Steps

1. Upgrade the package:

   ```bash
   npm install stateless-seal@^1.0.0
   ```

2. Run your app tests:

   ```bash
   npm run typecheck
   npm test
   ```

3. Confirm your keyring still includes old keys until old tokens expire.

4. Confirm any one-time flows still use `unsealOnce()` with a replay store.

5. Confirm public responses do not expose detailed token rejection codes.

---

## API Notes

The v1.0.0 public API keeps the v0.9.x surface:

- `createSealer()`
- `defineToken()`
- `Token.seal()`
- `Token.unseal()`
- `Token.unsealOnce()`
- `Token.unsealOrThrow()`
- `Token.unsealOrNull()`
- `Token.inspect()`
- `generateSealKey()`
- `memoryReplayStore()`
- `cloudflareKVReplayStore()`
- `createCookieSession()`
- `createTestClock()`
- `createTestSealer()`

Subpath exports remain:

- `stateless-seal`
- `stateless-seal/cloudflare`
- `stateless-seal/testing`
- `stateless-seal/cookie-session`

---

## Token Format

The v1 token format remains:

```txt
stseal.v1.<header>.<iv>.<ciphertext>
```

See `SPEC.md` and `STABILITY.md` for the compatibility contract.

---

## What Still Requires Application Review

Before deploying v1.0.0, review:

- key storage and rotation
- TTLs per token purpose
- replay store behavior for one-time flows
- cookie attributes for session cookies
- server-side logging and public error responses
- resource and tenant authorization checks after unsealing
