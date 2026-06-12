# Production Checklist

Use this checklist before deploying `stateless-seal` in production.

---

## Keys

- Generate keys with `npx stateless-seal keygen` or `generateSealKey()`.
- Store keys in a secret manager or environment variables.
- Never expose seal keys to browsers or mobile clients.
- Use different keys for dev, staging, and production.
- Use clear key ids such as `2026-06`.
- Keep previous keys until every old token has expired.
- Remove compromised keys immediately.

---

## Policies

- Define one token policy per purpose.
- Do not reuse a `session` token as a `password-reset` token.
- Keep TTLs short.
- Set `audience` for different clients or surfaces.
- Use schemas for payload validation.
- Use `maxTokenSize` if a route expects small tokens.
- Use `clockTolerance` sparingly.
- Use `notBefore` only when delayed activation is truly needed.

---

## One-Time Flows

Use `oneTime: true` and `unsealOnce()` for:

- password reset
- magic links
- invite acceptance when accepting should consume the link
- high-value email verification flows

Use a shared replay store in multi-instance deployments.

Treat `replay_store_failed` as rejection.

---

## Cookies

- Prefer `__Host-` cookie names for host-only session cookies.
- Use `HttpOnly`.
- Use `Secure`.
- Use `SameSite=Lax` or `SameSite=Strict` unless cross-site behavior is
  required.
- Keep session TTLs short.
- Clear cookies with `session.clear()` or `clearCookie()`.

---

## Runtime

- Use Web Crypto capable runtimes.
- Keep core runtime code free of Node-only APIs.
- Run the edge compatibility test before release.
- Check `npm pack --dry-run` before publishing.

---

## Error Handling

- Log detailed error codes server-side.
- Return generic errors to users.
- Do not expose `purpose_mismatch`, `audience_mismatch`, or `decrypt_failed` to
  untrusted clients.
- Alert on spikes of `decrypt_failed`, `token_too_large`, `unknown_kid`, or
  `replayed`.

---

## Authorization

Token validity is not authorization by itself.

After unsealing:

- compare resource ids to the current request
- compare tenant ids to the current tenant
- check the user still has access
- check server-side account state when required

Purpose binding tells you what the token is for. Your app still decides whether
the action is allowed.

---

## Release Checks

Run:

```bash
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

Before publish, confirm the package contains the expected `dist/`, docs,
examples, test vectors, and CLI files.
