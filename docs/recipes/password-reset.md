# Password Reset

Password reset links should be short-lived and one-time.

Use a dedicated purpose and a replay store:

```ts
import { createSealer } from "stateless-seal";
import { cloudflareKVReplayStore } from "stateless-seal/cloudflare";

const sealer = createSealer({
  issuer: "my-app",
  keys: {
    "2026-05": env.SEAL_KEY_2026_05
  },
  currentKeyId: "2026-05"
});

const PasswordResetToken = sealer.defineToken<{ userId: string }>({
  purpose: "password-reset",
  ttl: "15m",
  audience: "web",
  oneTime: true,
  schema: {
    parse(input: unknown): { userId: string } {
      if (!input || typeof input !== "object") {
        throw new Error("Invalid payload.");
      }

      const value = input as Record<string, unknown>;

      if (typeof value.userId !== "string") {
        throw new Error("Invalid payload.");
      }

      return {
        userId: value.userId
      };
    }
  }
});
```

Create a link:

```ts
export async function createPasswordResetLink(userId: string) {
  const token = await PasswordResetToken.seal({ userId });
  return `https://example.com/reset-password?token=${encodeURIComponent(token)}`;
}
```

Verify and consume it:

```ts
export async function verifyPasswordResetToken(token: string) {
  const result = await PasswordResetToken.unsealOnce(token, {
    store: cloudflareKVReplayStore(env.REPLAY_KV)
  });

  if (!result.ok) {
    return null;
  }

  return result.payload.userId;
}
```

Do not reveal whether the token was expired, malformed, already used, or for a
different purpose in the browser response. Use a generic failure message.
