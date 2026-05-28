import { describe, expect, it } from "vitest";
import { createSealer, generateSealKey } from "../src";
import { cloudflareKVReplayStore } from "../src/cloudflare";
import type { CloudflareKVNamespace } from "../src/cloudflare";

class FakeKVNamespace implements CloudflareKVNamespace {
  readonly values = new Map<string, string>();
  readonly puts: Array<{
    key: string;
    value: string;
    expirationTtl?: number;
  }> = [];

  async get(key: string, type: "text"): Promise<string | null> {
    expect(type).toBe("text");
    return this.values.get(key) ?? null;
  }

  async put(
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ): Promise<void> {
    this.values.set(key, value);
    this.puts.push({
      key,
      value,
      ...(options?.expirationTtl !== undefined
        ? { expirationTtl: options.expirationTtl }
        : {})
    });
  }
}

describe("cloudflareKVReplayStore", () => {
  it("consumes a token id once and marks replays", async () => {
    const namespace = new FakeKVNamespace();
    const store = cloudflareKVReplayStore(namespace, {
      prefix: "test:",
      clock: () => 1000
    });

    await expect(store.consume("jti_123", 11_000)).resolves.toBe("ok");
    await expect(store.consume("jti_123", 11_000)).resolves.toBe("replayed");

    expect(namespace.puts).toEqual([
      {
        key: "test:jti_123",
        value: "1",
        expirationTtl: 60
      }
    ]);
  });

  it("uses token expiry when it is above the minimum ttl", async () => {
    const namespace = new FakeKVNamespace();
    const store = cloudflareKVReplayStore(namespace, {
      clock: () => 1_000,
      minimumTtlSeconds: 60
    });

    await expect(store.consume("jti_123", 121_000)).resolves.toBe("ok");

    expect(namespace.puts[0]?.expirationTtl).toBe(120);
  });

  it("clamps the minimum ttl to the Cloudflare KV floor", async () => {
    const namespace = new FakeKVNamespace();
    const store = cloudflareKVReplayStore(namespace, {
      clock: () => 1_000,
      minimumTtlSeconds: 1
    });

    await expect(store.consume("jti_123", 2_000)).resolves.toBe("ok");

    expect(namespace.puts[0]?.expirationTtl).toBe(60);
  });

  it("works with unsealOnce", async () => {
    const key = generateSealKey();
    const namespace = new FakeKVNamespace();
    let now = 1000;

    const sealer = createSealer({
      issuer: "cloudflare-worker-demo",
      keys: {
        "2026-05": key
      },
      currentKeyId: "2026-05",
      clock: () => now
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
    const store = cloudflareKVReplayStore(namespace, {
      clock: () => now
    });

    const first = await MagicLinkToken.unsealOnce(token, { store });

    expect(first.ok).toBe(true);

    if (first.ok) {
      expect(first.payload.userId).toBe("user_123");
    }

    now = 2000;

    const second = await MagicLinkToken.unsealOnce(token, { store });

    expect(second.ok).toBe(false);

    if (!second.ok) {
      expect(second.code).toBe("replayed");
    }
  });

  it("propagates KV failures through replay_store_failed", async () => {
    const key = generateSealKey();
    const namespace: CloudflareKVNamespace = {
      async get() {
        throw new Error("KV unavailable");
      },
      async put() {
        throw new Error("KV unavailable");
      }
    };

    const sealer = createSealer({
      issuer: "cloudflare-worker-demo",
      keys: {
        "2026-05": key
      },
      currentKeyId: "2026-05"
    });

    const Token = sealer.defineToken<{ userId: string }>({
      purpose: "magic-link",
      ttl: "10m",
      oneTime: true
    });

    const token = await Token.seal({
      userId: "user_123"
    });
    const result = await Token.unsealOnce(token, {
      store: cloudflareKVReplayStore(namespace)
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.code).toBe("replay_store_failed");
    }
  });
});
