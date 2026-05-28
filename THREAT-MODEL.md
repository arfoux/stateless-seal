# Threat Model

This document describes what `stateless-seal` is designed to protect, what it
does not protect, and where applications must still make security decisions.

## Assets

`stateless-seal` helps protect:

- encrypted application payloads
- token integrity
- purpose boundaries between application flows
- issuer boundaries between applications
- audience boundaries within an application
- short token lifetimes
- key rotation by key id

## Attacker Capabilities

The attacker can:

- read tokens from URLs, cookies, logs, browser history, or client storage
- submit arbitrary token strings to an application
- modify token bytes
- replay a valid token during its lifetime
- choose or influence payloads in some application flows
- observe token length
- send malformed or oversized tokens
- know the token format and source code

## Attacker Non-Capabilities

The model assumes the attacker cannot:

- access server-side sealing keys
- compromise the runtime's Web Crypto implementation
- predict the runtime CSPRNG
- break AES-GCM
- alter trusted server-side policy definitions
- bypass the application's transport security

If these assumptions fail, `stateless-seal` cannot provide its intended
guarantees.

## Security Guarantees

When used with strong keys and correct application policy, Stateless Seal v1
provides:

- payload confidentiality
- payload integrity
- authenticated public header metadata
- purpose binding
- issuer binding
- optional audience binding
- expiration enforcement
- optional not-before enforcement
- key rotation support through `kid`

## Non-Guarantees

`stateless-seal` does not provide:

- immediate per-token revocation without state
- one-time use without a replay store
- public verification by clients
- third-party federation
- OAuth or OIDC semantics
- authorization policy decisions
- hiding header metadata
- hiding token length
- protection if application keys leak
- protection if valid tokens are logged or exposed

## Replay Risk

Stateless tokens are bearer tokens. Anyone who obtains a valid token can replay
it until the token expires.

For sensitive one-time flows such as password reset, magic links, or email
verification, applications should use short TTLs. A future replay protection
layer should add `jti` plus a replay store so tokens can be consumed once.

Until then, treat `stateless-seal` as a short-lived sealed token primitive, not
as a complete one-time token system.

## Header Visibility

The header is plaintext. This is intentional so verifiers can identify the
algorithm, key id, purpose, issuer, and audience before decryption.

Do not place secrets, emails, user ids, internal database ids, or other
sensitive values in the header. Put sensitive values in the encrypted payload.

## Time Handling

The verifier enforces:

- `exp`: token expiration
- `nbf`: optional not-before activation time

Clock tolerance can make distributed systems easier to operate, but a large
tolerance effectively extends token lifetime. Applications should keep clock
tolerance small.

## Key Management

Applications are responsible for:

- generating 32-byte random keys
- storing keys in environment variables or secret managers
- rotating keys
- keeping old keys only until issued tokens expire
- removing compromised keys

If a key leaks, tokens sealed with that key should be considered compromised.

## Token Size

The SDK rejects tokens larger than 16 KiB by default before parsing or
decrypting. Applications should configure smaller token size limits for
sensitive flows. Large tokens can waste CPU and memory during parsing, decoding,
and decryption.

Recommended starting points:

- password reset: 2048 bytes
- magic link: 2048 bytes
- email verification: 2048 bytes
- session cookie: 4096 bytes
- temporary grants: 4096 to 8192 bytes

## Safe Application Pattern

Do not expose detailed rejection reasons to untrusted clients.

Recommended:

```ts
const result = await Token.unseal(token);

if (!result.ok) {
  logger.warn("token rejected", { code: result.code });
  return new Response("Invalid token", { status: 401 });
}
```

Avoid:

```ts
return Response.json({ error: result.code }, { status: 401 });
```

## Future Threat Model Extensions

Future versions should extend this document for:

- replay store failure modes
- one-time token semantics
- Redis and Cloudflare KV consistency behavior
- context binding
- external associated data
- CLI operational safety
