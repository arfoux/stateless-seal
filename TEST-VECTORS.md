# Stateless Seal Test Vectors

Official test vectors live in `test-vectors/v1`.

They are intended for:

- verifying the JavaScript/TypeScript SDK
- checking compatibility across runtimes
- helping future Go, Rust, Python, PHP, or other implementations
- detecting accidental format changes
- giving security reviewers concrete examples

## Vector Format

Each vector is a JSON file:

```json
{
  "name": "valid password reset token",
  "version": "v1",
  "description": "Short human-readable description.",
  "keyId": "2026-05",
  "key": "base64url-32-byte-key",
  "iv": "base64url-12-byte-iv",
  "issuer": "example-app",
  "purpose": "password-reset",
  "audience": "web",
  "now": 1779340000000,
  "payload": {
    "userId": "user_123"
  },
  "token": "stseal.v1....",
  "verify": {
    "issuer": "example-app",
    "purpose": "password-reset",
    "audience": "web",
    "now": 1779340000000,
    "keys": {
      "2026-05": "base64url-32-byte-key"
    },
    "currentKeyId": "2026-05"
  },
  "expected": {
    "ok": true,
    "payload": {
      "userId": "user_123"
    }
  }
}
```

Invalid vectors use:

```json
{
  "expected": {
    "ok": false,
    "code": "purpose_mismatch"
  }
}
```

## Deterministic Generation

The vectors use a fixed test key and fixed IV so token strings are stable.

Never use the vector key or IV generation pattern in production.

Production tokens MUST use a fresh random 96-bit IV for every sealed token.

## Fixed v1 Test Inputs

The current v1 vectors use:

- key id: `2026-05`
- key: `AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8`
- IV: `ICEiIyQlJicoKSor`
- issuer: `example-app`
- purpose: `password-reset`
- audience: `web` where applicable
- issued at: `1779340000000`
- expires at: `1779340900000`
- not before: `1779340030000` where applicable
- token id: `test-jti-0001` where applicable
- payload: `{ "userId": "user_123" }`

## Compatibility Rules

An implementation passes the v1 vector set when it:

- accepts all `valid-*` vectors
- returns the expected payload for valid vectors
- rejects all `invalid-*` vectors
- reports an equivalent rejection reason for invalid vectors
- computes AAD from the exact encoded header segment
- does not require canonical JSON during verification
