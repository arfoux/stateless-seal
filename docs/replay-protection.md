# Replay Protection

Stateless Seal tokens are bearer tokens. Without a replay store, anyone who has
a valid token can reuse it until it expires.

For one-time flows such as magic links, password reset, and email verification,
use:

- short TTLs
- `oneTime: true`
- `Token.unsealOnce(token, { store })`
- a replay store shared by every instance that can accept the token

## Basic API

```ts
import { createSealer, memoryReplayStore } from "stateless-seal";

const sealer = createSealer({
  issuer: "my-app",
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

const token = await MagicLinkToken.seal({
  userId: "user_123"
});

const result = await MagicLinkToken.unsealOnce(token, {
  store: memoryReplayStore()
});
```

The second successful-looking use of the same token returns:

```ts
{
  ok: false,
  code: "replayed"
}
```

## ReplayStore

The replay store interface is intentionally small:

```ts
type ReplayStore = {
  consume(id: string, expiresAt: number): Promise<"ok" | "replayed">;
};
```

`consume()` must be atomic for production one-time guarantees.

Behavior:

- return `"ok"` when the id has not been consumed
- store the id until at least `expiresAt`
- return `"replayed"` if the id was already consumed
- throw if the store cannot make a reliable decision

If the store throws, `unsealOnce()` returns:

```ts
{
  ok: false,
  code: "replay_store_failed"
}
```

Applications should reject the request when this happens.

## Why unseal() rejects one-time policies

For policies with `oneTime: true`, `Token.unseal()` returns:

```ts
{
  ok: false,
  code: "replay_required"
}
```

This prevents accidentally accepting a one-time token without consuming its
`jti`.

Use `unsealOnce()` for one-time policies.

## memoryReplayStore()

`memoryReplayStore()` is useful for:

- tests
- local development
- single-process demos

It is not a production replay store for multi-instance deployments. Each
process has its own memory, so another server instance would not know the token
was already consumed.

Production adapters should use a shared store such as Cloudflare KV, Redis,
Upstash, Deno KV, a database table with a unique constraint, or a Cloudflare
Durable Object.

Cloudflare KV support is available through:

```ts
import { cloudflareKVReplayStore } from "stateless-seal/cloudflare";
```

See [cloudflare-workers.md](./cloudflare-workers.md).

Cloudflare KV is eventually consistent. It is a simple shared edge replay store,
but it is not a strict global atomic consume primitive under simultaneous
submissions. Use a strongly consistent store for high-value flows that require
exactly-once behavior under concurrency.

## Production Rules

- Keep one-time token TTLs short.
- Use a shared replay store.
- Treat replay store failures as token rejection.
- Do not expose `replayed` or `replay_store_failed` to end users.
- Keep detailed rejection codes in internal logs only.
