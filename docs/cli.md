# CLI

`stateless-seal` ships a small dependency-free CLI for key generation,
unverified token inspection, and local seal/unseal debugging.

The CLI is for developer workflows and debugging. It does not replace server
side token verification.

---

## Generate a key

```bash
npx stateless-seal keygen
```

Output is a 32-byte base64url key suitable for AES-256-GCM:

```txt
AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8
```

Store production keys in your runtime secret manager or environment variables.
Do not hardcode generated keys in source code.

---

## Inspect a token

```bash
npx stateless-seal inspect "stseal.v1...."
```

Example output:

```txt
Token: stseal
Version: v1
Algorithm: A256GCM
Key ID: 2026-05
Purpose: password-reset
Issuer: example-app
Audience: web
Verified: no
```

`inspect` only decodes public header metadata. It does not verify, decrypt, or
prove that a token is valid.

Use `Token.unseal()` or `Token.unsealOnce()` in your application to verify and
decrypt tokens.

---

## Seal a token

```bash
npx stateless-seal seal \
  --key "$SEAL_KEY" \
  --kid "2026-05" \
  --issuer "example-app" \
  --purpose "password-reset" \
  --audience "web" \
  --ttl "15m" \
  --payload '{"userId":"user_123"}'
```

The command writes the sealed token to stdout.

`--audience` is optional. `--ttl` accepts milliseconds as a number or duration
strings such as `30s`, `15m`, `1h`, and `7d`.

For shells where JSON quoting is awkward, read the payload from a file:

```bash
npx stateless-seal seal \
  --key "$SEAL_KEY" \
  --kid "2026-05" \
  --issuer "example-app" \
  --purpose "password-reset" \
  --ttl "15m" \
  --payload-file ./payload.json
```

---

## Unseal a token

```bash
npx stateless-seal unseal "$TOKEN" \
  --key "$SEAL_KEY" \
  --issuer "example-app" \
  --purpose "password-reset" \
  --audience "web"
```

The command verifies the issuer, purpose, optional audience, expiry, and AES-GCM
authentication tag before printing the decrypted JSON payload.

Use `--kid` when you want the CLI to reject tokens whose public key id does not
match the key you intended to use.

```bash
npx stateless-seal unseal "$TOKEN" \
  --key "$SEAL_KEY" \
  --kid "2026-05" \
  --issuer "example-app" \
  --purpose "password-reset" \
  --json
```

With `--json`, output includes:

```json
{
  "ok": true,
  "payload": {
    "userId": "user_123"
  },
  "meta": {
    "version": "v1",
    "algorithm": "A256GCM",
    "keyId": "2026-05",
    "purpose": "password-reset",
    "issuer": "example-app"
  }
}
```

Do not paste production secrets or decrypted payloads into shared terminals,
issue trackers, or logs.

---

## JSON output

```bash
npx stateless-seal inspect "stseal.v1...." --json
```

This is useful for scripts and CI diagnostics.

---

## Version

```bash
npx stateless-seal version
```
