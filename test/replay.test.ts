import { describe, expect, it } from "vitest";
import {
  createSealer,
  generateSealKey,
  memoryReplayStore
} from "../src";
import type { ReplayStore } from "../src";
import { logTestStep, summarizeResult, summarizeToken } from "./debug-log";

describe("replay protection", () => {
  it("consumes a one-time token once and rejects replay", async () => {
    const key = generateSealKey();
    let now = 1000;

    const sealer = createSealer({
      issuer: "my-app",
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
    const store = memoryReplayStore({
      clock: () => now
    });

    const first = await MagicLinkToken.unsealOnce(token, { store });

    logTestStep("replay.once.first", {
      token: summarizeToken(token),
      result: summarizeResult(first)
    });

    expect(first.ok).toBe(true);

    if (first.ok) {
      expect(first.payload).toEqual({ userId: "user_123" });
      expect(first.meta.tokenId).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(first.meta.expiresAt).toBe(601000);
    }

    now = 2000;

    const second = await MagicLinkToken.unsealOnce(token, { store });

    logTestStep("replay.once.second", {
      now,
      result: summarizeResult(second)
    });

    expect(second.ok).toBe(false);

    if (!second.ok) {
      expect(second.code).toBe("replayed");
    }
  });

  it("requires unsealOnce for one-time token policies", async () => {
    const key = generateSealKey();

    const sealer = createSealer({
      issuer: "my-app",
      keys: {
        "2026-05": key
      },
      currentKeyId: "2026-05"
    });

    const MagicLinkToken = sealer.defineToken<{ userId: string }>({
      purpose: "magic-link",
      ttl: "10m",
      oneTime: true
    });

    const token = await MagicLinkToken.seal({
      userId: "user_123"
    });
    const result = await MagicLinkToken.unseal(token);

    logTestStep("replay.requires-unseal-once", {
      token: summarizeToken(token),
      result: summarizeResult(result)
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.code).toBe("replay_required");
    }
  });

  it("rejects unsealOnce for tokens without a jti", async () => {
    const key = generateSealKey();

    const sealer = createSealer({
      issuer: "my-app",
      keys: {
        "2026-05": key
      },
      currentKeyId: "2026-05"
    });

    const SessionToken = sealer.defineToken<{ userId: string }>({
      purpose: "session",
      ttl: "1h"
    });

    const token = await SessionToken.seal({
      userId: "user_123"
    });
    const result = await SessionToken.unsealOnce(token, {
      store: memoryReplayStore()
    });

    logTestStep("replay.missing-jti", {
      token: summarizeToken(token),
      result: summarizeResult(result)
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.code).toBe("missing_jti");
    }
  });

  it("does not consume expired tokens", async () => {
    const key = generateSealKey();
    let now = 1000;
    let consumeCalls = 0;

    const store: ReplayStore = {
      async consume() {
        consumeCalls += 1;
        return "ok";
      }
    };

    const sealer = createSealer({
      issuer: "my-app",
      keys: {
        "2026-05": key
      },
      currentKeyId: "2026-05",
      clock: () => now
    });

    const Token = sealer.defineToken<{ userId: string }>({
      purpose: "magic-link",
      ttl: "1s",
      oneTime: true
    });

    const token = await Token.seal({
      userId: "user_123"
    });

    now = 3000;

    const result = await Token.unsealOnce(token, { store });

    logTestStep("replay.expired-not-consumed", {
      now,
      consumeCalls,
      result: summarizeResult(result)
    });

    expect(result.ok).toBe(false);
    expect(consumeCalls).toBe(0);

    if (!result.ok) {
      expect(result.code).toBe("expired");
    }
  });

  it("returns replay_store_failed when the replay store throws", async () => {
    const key = generateSealKey();

    const store: ReplayStore = {
      async consume() {
        throw new Error("store unavailable");
      }
    };

    const sealer = createSealer({
      issuer: "my-app",
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
    const result = await Token.unsealOnce(token, { store });

    logTestStep("replay.store-failed", {
      token: summarizeToken(token),
      result: summarizeResult(result)
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.code).toBe("replay_store_failed");
    }
  });
});
