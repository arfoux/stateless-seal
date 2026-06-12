import { describe, expect, it } from "vitest";
import { createSealer, generateSealKey } from "../src";
import { logTestStep, summarizeResult, summarizeToken } from "./debug-log";

describe("expiry", () => {
  it("rejects expired tokens", async () => {
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

    const Token = sealer.defineToken<{ userId: string }>({
      purpose: "session",
      ttl: "1s",
      audience: "web"
    });

    const token = await Token.seal({ userId: "user_123" });

    now = 3000;

    const result = await Token.unseal(token);

    logTestStep("expiry.expired", {
      token: summarizeToken(token),
      now,
      result: summarizeResult(result)
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.code).toBe("expired");
    }
  });

  it("accepts token before expiry", async () => {
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

    const Token = sealer.defineToken<{ userId: string }>({
      purpose: "session",
      ttl: "10s",
      audience: "web"
    });

    const token = await Token.seal({ userId: "user_123" });

    now = 5000;

    const result = await Token.unseal(token);

    logTestStep("expiry.before-expiry", {
      token: summarizeToken(token),
      now,
      result: summarizeResult(result)
    });

    expect(result.ok).toBe(true);
  });
});
