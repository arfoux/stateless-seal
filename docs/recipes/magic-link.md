# Magic Link

Magic links are bearer credentials. They should be short-lived and one-time.

```ts
import { createSealer } from "stateless-seal";
import { cloudflareKVReplayStore } from "stateless-seal/cloudflare";

const MagicLinkToken = sealer.defineToken<{ userId: string; email: string }>({
  purpose: "magic-link",
  ttl: "10m",
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

export async function createMagicLink(userId: string, email: string) {
  const token = await MagicLinkToken.seal({ userId, email });
  return `https://example.com/login/magic?token=${encodeURIComponent(token)}`;
}

export async function verifyMagicLink(token: string) {
  const result = await MagicLinkToken.unsealOnce(token, {
    store: cloudflareKVReplayStore(env.REPLAY_KV)
  });

  if (!result.ok) {
    return null;
  }

  return result.payload;
}
```

For consumer apps, avoid binding magic links to IP addresses. IP addresses can
change during normal mobile and residential network use.
