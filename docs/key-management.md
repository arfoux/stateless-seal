# Key Management

`stateless-seal` uses AES-256-GCM keys.

A production key must be 32 bytes of random data, encoded as base64url without
padding. Generate keys with:

```bash
npx stateless-seal keygen
```

or:

```ts
import { generateSealKey } from "stateless-seal";

console.log(generateSealKey());
```

Do not derive production keys from short passwords, app names, user ids, or
human-readable secrets.

---

## Store Keys As Secrets

Keep seal keys in your platform secret manager or environment variables:

```env
SEAL_KEY_2026_05="..."
SEAL_KEY_2026_06="..."
```

Do not commit keys to source control.

Do not put keys in client-side JavaScript.

Do not log keys.

---

## Key IDs

Each key has a key id (`kid`). The key id is public metadata in the token header.

Use boring, stable identifiers:

```ts
const sealer = createSealer({
  issuer: "my-app",
  keys: {
    "2026-06": env.SEAL_KEY_2026_06,
    "2026-05": env.SEAL_KEY_2026_05
  },
  currentKeyId: "2026-06"
});
```

Good key ids:

- `2026-06`
- `prod-2026-06`
- `edge-2026-06`

Avoid putting secrets, internal hostnames, or incident details in key ids.

---

## Rotation

Rotation has two phases:

1. Add the new key and make it current.
2. Keep old keys until every token sealed with them has expired.

Example:

```ts
const sealer = createSealer({
  issuer: "my-app",
  keys: {
    "2026-06": env.SEAL_KEY_2026_06,
    "2026-05": env.SEAL_KEY_2026_05
  },
  currentKeyId: "2026-06"
});
```

New tokens are sealed with `2026-06`.

Old tokens with `kid: "2026-05"` can still be unsealed until you remove the old
key from the keyring.

Remove the old key after the longest possible token lifetime has passed,
including clock tolerance.

---

## Emergency Rotation

If a key may be compromised:

1. Generate a new key.
2. Deploy it as `currentKeyId`.
3. Remove the suspected key from the keyring if you must immediately reject old
   tokens.
4. Expect all tokens sealed with the removed key to fail with `unknown_kid`.
5. Force re-authentication or re-issue affected flows.

This is the tradeoff: immediate rejection requires state change through key
removal, which invalidates every token using that key.

---

## Separate Environments

Use different keys for development, staging, and production.

Do not share production keys with local development or CI.

For tests, use `stateless-seal/testing`:

```ts
import { createTestSealer } from "stateless-seal/testing";

const { sealer, clock } = createTestSealer();
```

The exported test key is stable by design and must not be used in production.

---

## Operational Checklist

- Generate keys from a CSPRNG.
- Store keys in a secret manager.
- Give each key a clear `kid`.
- Keep old keys until old tokens expire.
- Remove compromised keys immediately.
- Use short token TTLs.
- Keep `issuer` stable for an app or service.
- Use `audience` when tokens target different clients or surfaces.
- Monitor token rejection codes server-side, but do not expose them to users.
