# Stateless Seal v1 Test Vectors

These vectors are deterministic compatibility fixtures for the `stseal.v1`
format described in `SPEC.md`.

The key and IV in this directory are public test values. Do not use them in
production.

Valid vectors:

- `valid-basic.json`
- `valid-with-audience.json`
- `valid-with-jti.json`
- `valid-with-nbf.json`

Invalid vectors:

- `invalid-wrong-purpose.json`
- `invalid-wrong-issuer.json`
- `invalid-wrong-audience.json`
- `invalid-expired.json`
- `invalid-tampered-header.json`
- `invalid-tampered-ciphertext.json`
- `invalid-unknown-kid.json`
