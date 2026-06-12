# Testing Helpers

`stateless-seal/testing` provides small helpers for application tests.

They are dependency-free and use the same core APIs as production code, but
they intentionally use a stable test key and a controllable clock.

Do not use the exported test key in production.

---

## `createTestClock(initialTime?)`

Creates a fake clock for expiry, `nbf`, and replay tests.

```ts
import { createTestClock } from "stateless-seal/testing";

const clock = createTestClock(1000);

clock.now(); // 1000
clock.advance("10m");
clock.set(new Date("2026-05-31T00:00:00.000Z"));
```

`advance()` accepts the same duration format as token TTLs:

- number in milliseconds
- `"500ms"`
- `"30s"`
- `"15m"`
- `"1h"`
- `"7d"`

---

## `createTestSealer(options?)`

Creates a sealer wired to a test clock and a stable 32-byte test key.

```ts
import { createTestSealer } from "stateless-seal/testing";

const { sealer, clock } = createTestSealer({
  issuer: "test-app",
  now: 1000
});

const SessionToken = sealer.defineToken<{ userId: string }>({
  purpose: "session",
  ttl: "10s"
});

const token = await SessionToken.seal({
  userId: "user_123"
});

await SessionToken.unseal(token);

clock.advance("11s");

const expired = await SessionToken.unseal(token);
expired.ok; // false
```

---

## One-time token tests

Use the returned clock with `memoryReplayStore()` when testing replay
protection.

```ts
import { memoryReplayStore } from "stateless-seal";
import { createTestSealer } from "stateless-seal/testing";

const { sealer, clock } = createTestSealer({
  now: 1000
});

const store = memoryReplayStore({
  clock: clock.now
});

const MagicLinkToken = sealer.defineToken<{ userId: string }>({
  purpose: "magic-link",
  ttl: "10m",
  oneTime: true
});

const token = await MagicLinkToken.seal({
  userId: "user_123"
});

const first = await MagicLinkToken.unsealOnce(token, { store });
const second = await MagicLinkToken.unsealOnce(token, { store });

first.ok; // true
second.ok; // false, replayed
```

---

## Exports

```ts
import {
  TEST_ISSUER,
  TEST_KEY_ID,
  TEST_SEAL_KEY,
  createTestClock,
  createTestSealer
} from "stateless-seal/testing";
```
