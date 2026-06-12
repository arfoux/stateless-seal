# Recipes

These recipes show common app-token flows built with `stateless-seal`.

They are framework-agnostic and edge-runtime friendly. The examples focus on
policy shape, token lifetime, replay protection, and the checks your app should
perform after unsealing a token.

---

## Recipes

- [Password reset](./password-reset.md)
- [Magic link](./magic-link.md)
- [Email verification](./email-verification.md)
- [Invite link](./invite-link.md)
- [Temporary download grant](./temporary-download-grant.md)
- [Session cookie](./session-cookie.md)

---

## General rules

- Use a different `purpose` for each flow.
- Keep TTLs short.
- Use `audience` when the same issuer serves multiple clients.
- Use `oneTime: true` with a replay store for password reset and magic links.
- Treat replay store failures as token rejection.
- Return generic responses to users. Log detailed error codes server-side only.
- Put resource and tenant identifiers in the encrypted payload, then compare
  them to the current request context after unsealing.
