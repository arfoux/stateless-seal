import { describe, expect, it } from "vitest";
import { memoryReplayStore } from "../src";
import {
  TEST_ISSUER,
  TEST_KEY_ID,
  TEST_SEAL_KEY,
  createTestClock,
  createTestSealer
} from "../src/testing";
import { logTestStep, summarizeResult, summarizeToken } from "./debug-log";

describe("testing helpers", () => {
  it("creates a controllable test clock", () => {
    const clock = createTestClock(1000);

    expect(clock.now()).toBe(1000);
    expect(clock.advance("2s")).toBe(3000);
    expect(clock.set(new Date(5000))).toBe(5000);
    expect(clock.advance(250)).toBe(5250);

    logTestStep("testing.clock", {
      finalNow: clock.now()
    });
  });

  it("creates a test sealer with stable defaults", async () => {
    const { sealer, clock, issuer, currentKeyId, keys } = createTestSealer({
      now: 1000
    });

    const Token = sealer.defineToken<{ userId: string }>({
      purpose: "session",
      ttl: "10s",
      audience: "web"
    });

    const token = await Token.seal({ userId: "user_123" });
    const valid = await Token.unseal(token);

    clock.advance("11s");

    const expired = await Token.unseal(token);

    logTestStep("testing.default-sealer", {
      issuer,
      currentKeyId,
      key: keys[currentKeyId],
      token: summarizeToken(token),
      valid: summarizeResult(valid),
      expired: summarizeResult(expired)
    });

    expect(issuer).toBe(TEST_ISSUER);
    expect(currentKeyId).toBe(TEST_KEY_ID);
    expect(keys[currentKeyId]).toBe(TEST_SEAL_KEY);
    expect(valid.ok).toBe(true);
    expect(expired.ok).toBe(false);

    if (!expired.ok) {
      expect(expired.code).toBe("expired");
    }
  });

  it("uses a single custom keyring entry as the current key", async () => {
    const { sealer, currentKeyId } = createTestSealer({
      issuer: "custom-app",
      keys: {
        "2026-05": TEST_SEAL_KEY
      }
    });

    const Token = sealer.defineToken<{ userId: string }>({
      purpose: "session",
      ttl: "1h"
    });

    const token = await Token.seal({ userId: "user_123" });
    const result = await Token.unseal(token);

    logTestStep("testing.custom-keyring", {
      currentKeyId,
      token: summarizeToken(token),
      result: summarizeResult(result)
    });

    expect(currentKeyId).toBe("2026-05");
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.meta.issuer).toBe("custom-app");
      expect(result.meta.keyId).toBe("2026-05");
    }
  });

  it("requires a current key id for multiple custom keys", () => {
    logTestStep("testing.multiple-keyring-without-current-key", {
      keys: ["2026-05", "2026-06"],
      expectedError: "TypeError"
    });

    expect(() =>
      createTestSealer({
        keys: {
          "2026-05": TEST_SEAL_KEY,
          "2026-06": TEST_SEAL_KEY
        }
      })
    ).toThrow(TypeError);
  });

  it("works with replay tests", async () => {
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

    const token = await MagicLinkToken.seal({ userId: "user_123" });
    const first = await MagicLinkToken.unsealOnce(token, { store });
    const second = await MagicLinkToken.unsealOnce(token, { store });

    logTestStep("testing.replay", {
      token: summarizeToken(token),
      first: summarizeResult(first),
      second: summarizeResult(second)
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);

    if (!second.ok) {
      expect(second.code).toBe("replayed");
    }
  });

  it("rejects invalid test clock values", () => {
    logTestStep("testing.invalid-clock", {
      value: Number.NaN,
      expectedError: "TypeError"
    });

    expect(() => createTestClock(Number.NaN)).toThrow(TypeError);
  });
});
