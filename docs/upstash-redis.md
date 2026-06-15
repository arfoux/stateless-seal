# Upstash Redis Replay Store

`stateless-seal/upstash` provides a dependency-free replay store adapter for
Upstash Redis REST API.

Use it for one-time flows that need a shared, atomic replay store in edge and
serverless runtimes.

---

## Usage

```ts
import { upstashRedisReplayStore } from "stateless-seal/upstash";

const store = upstashRedisReplayStore({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN
});

const result = await MagicLinkToken.unsealOnce(token, {
  store
});
```

The adapter consumes token ids with Redis `SET key value EX ttl NX`.
It sends Redis commands using the
[Upstash Redis REST API](https://upstash.com/docs/redis/features/restapi)
JSON array command form.

Behavior:

- `SET ... NX` returns `OK`: the token id is consumed
- `SET ... NX` returns `null`: the token id was already consumed
- HTTP, Redis, or malformed responses throw and become `replay_store_failed`
  through `Token.unsealOnce()`

---

## Options

```ts
type UpstashRedisReplayStoreOptions = {
  url: string;
  token: string;
  prefix?: string;
  minimumTtlSeconds?: number;
  clock?: () => number;
  fetch?: typeof fetch;
};
```

`prefix` defaults to:

```txt
stateless-seal:replay:
```

`minimumTtlSeconds` defaults to `1`.

Pass `fetch` only when testing or when your runtime needs a custom fetch
implementation.

---

## Production Notes

- Keep one-time token TTLs short.
- Store Upstash credentials in runtime secrets.
- Treat replay store failures as token rejection.
- Do not expose `replayed` or `replay_store_failed` to end users.
- Use a separate key prefix per environment or app when sharing Redis.

The adapter uses `fetch` and does not add runtime dependencies.
