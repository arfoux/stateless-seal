# Cloudflare Workers

`stateless-seal` is designed for Web Crypto runtimes such as Cloudflare Workers.

The core package uses Web Crypto and does not require Node.js runtime APIs.

See also `examples/cloudflare-worker-magic-link.ts`.

## One-Time Magic Link With Workers KV

```ts
import { createSealer } from "stateless-seal";
import { cloudflareKVReplayStore } from "stateless-seal/cloudflare";

type Env = {
  SEAL_KEY_2026_05: string;
  REPLAY_KV: KVNamespace;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const sealer = createSealer({
      issuer: "cloudflare-worker-demo",
      keys: {
        "2026-05": env.SEAL_KEY_2026_05
      },
      currentKeyId: "2026-05"
    });

    const MagicLinkToken = sealer.defineToken<{ userId: string }>({
      purpose: "magic-link",
      ttl: "10m",
      audience: "web",
      oneTime: true
    });

    const replayStore = cloudflareKVReplayStore(env.REPLAY_KV);
    const url = new URL(request.url);

    if (url.pathname === "/create") {
      const token = await MagicLinkToken.seal({
        userId: "user_123"
      });

      return Response.json({ token });
    }

    if (url.pathname === "/verify") {
      const token = url.searchParams.get("token");

      if (!token) {
        return Response.json({ error: "missing_token" }, { status: 400 });
      }

      const result = await MagicLinkToken.unsealOnce(token, {
        store: replayStore
      });

      if (!result.ok) {
        return Response.json({ error: "invalid_token" }, { status: 401 });
      }

      return Response.json({
        userId: result.payload.userId
      });
    }

    return Response.json({
      routes: ["/create", "/verify?token=..."]
    });
  }
};
```

## Adapter API

```ts
const store = cloudflareKVReplayStore(env.REPLAY_KV, {
  prefix: "stateless-seal:replay:",
  minimumTtlSeconds: 60
});
```

Options:

- `prefix`: KV key prefix for replay markers
- `clock`: optional clock override for tests
- `minimumTtlSeconds`: minimum KV marker TTL, default `60`

`minimumTtlSeconds` defaults to `60` because Workers KV has a minimum TTL for
expiring keys. Values below `60` are clamped to `60`. Storing replay markers
longer than the token lifetime is safe; it only prevents the same token id from
being reused after the token would already be rejected as expired.

## Consistency Note

Cloudflare Workers KV is globally distributed and eventually consistent. This
adapter is useful as a simple shared replay store for many edge app flows, but
it is not a strict global compare-and-set primitive under simultaneous
submissions.

For high-value flows that require strict exactly-once consumption under
concurrency, use a strongly consistent store or a Cloudflare Durable Object
based replay store.

Regardless of store choice, keep one-time token TTLs short and treat replay
store failures as token rejection.
