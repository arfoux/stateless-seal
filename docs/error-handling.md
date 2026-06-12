# Error Handling

`Token.unseal()` and `Token.unsealOnce()` return Result objects.

Use detailed error codes for server-side logs and metrics. Return generic
responses to users.

---

## Server-Side Handling

```ts
const result = await PasswordResetToken.unsealOnce(token, {
  store: replayStore
});

if (!result.ok) {
  logger.warn("seal token rejected", {
    code: result.code,
    purpose: "password-reset"
  });

  return new Response("Invalid token", { status: 401 });
}
```

Do not send `result.code` directly to browsers or API clients unless the caller
is trusted.

Bad:

```ts
return Response.json({ error: result.code }, { status: 401 });
```

Good:

```ts
return Response.json({ error: "invalid_token" }, { status: 401 });
```

---

## Error Groups

Configuration and key errors:

- `invalid_config`
- `invalid_policy`
- `invalid_options`
- `invalid_key`
- `unknown_kid`

Malformed or unsupported tokens:

- `malformed_token`
- `unsupported_version`
- `unsupported_algorithm`
- `token_too_large`

Cryptographic rejection:

- `decrypt_failed`

Policy rejection:

- `expired`
- `not_yet_valid`
- `purpose_mismatch`
- `issuer_mismatch`
- `audience_mismatch`
- `schema_validation_failed`

Replay protection:

- `replay_required`
- `missing_jti`
- `replayed`
- `replay_store_failed`

Cookie session helper:

- `missing_cookie`

---

## Suggested Public Responses

For authentication/session cookies:

```ts
if (!result.ok) {
  return new Response("Unauthorized", { status: 401 });
}
```

For password reset, email verification, magic links, and invite links:

```ts
if (!result.ok) {
  return new Response("Invalid or expired link", { status: 400 });
}
```

For temporary download grants:

```ts
if (!result.ok) {
  return new Response("Forbidden", { status: 403 });
}
```

---

## Replay Store Failures

If a one-time token requires a replay store and the store is unavailable, reject
the token.

Do not fall back to plain `unseal()` for one-time flows. Accepting tokens while
the replay store is down silently disables one-time guarantees.

```ts
if (!result.ok && result.code === "replay_store_failed") {
  return new Response("Try again later", { status: 503 });
}
```

---

## Inspect Is Not Verification

`Token.inspect()` and `stateless-seal inspect` read public metadata only.

They do not prove that:

- the token was created by your app
- the ciphertext is valid
- the token is not expired
- the token matches your purpose, issuer, or audience

Use `unseal()` or `unsealOnce()` before trusting any payload.
