# CLI

`stateless-seal` ships a small dependency-free CLI for key generation and
unverified token inspection.

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
