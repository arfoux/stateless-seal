# Email Verification

Email verification tokens prove control of an email inbox for a short period.

They can be one-time if you have a replay store. If your verification operation
is idempotent, short-lived stateless tokens can also be acceptable.

```ts
const EmailVerificationToken = sealer.defineToken<{
  userId: string;
  email: string;
}>({
  purpose: "email-verification",
  ttl: "24h",
  audience: "web",
  oneTime: true,
  schema: {
    parse(input: unknown): { userId: string; email: string } {
      if (!input || typeof input !== "object") {
        throw new Error("Invalid payload.");
      }

      const value = input as Record<string, unknown>;

      if (typeof value.userId !== "string" || typeof value.email !== "string") {
        throw new Error("Invalid payload.");
      }

      return {
        userId: value.userId,
        email: value.email
      };
    }
  }
});
```

When verifying, compare the encrypted email payload to the email address you are
about to mark as verified.

```ts
const result = await EmailVerificationToken.unsealOnce(token, {
  store: replayStore
});

if (!result.ok) {
  return null;
}

await markEmailVerified(result.payload.userId, result.payload.email);
```

Do not reuse a `password-reset` token for email verification. Use a dedicated
purpose.
