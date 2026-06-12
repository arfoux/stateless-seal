import { describe, expect, it } from "vitest";
import { SealError, createSealer, generateSealKey } from "../src";
import { logTestStep, summarizeResult, summarizeToken } from "./debug-log";

describe("token options", () => {
  it("rejects tokens above maxTokenSize before parsing", async () => {
    const key = generateSealKey();

    const sealer = createSealer({
      issuer: "my-app",
      keys: {
        "2026-05": key
      },
      currentKeyId: "2026-05"
    });

    const Token = sealer.defineToken<{ userId: string }>({
      purpose: "session",
      ttl: "1h",
      audience: "web",
      maxTokenSize: 32
    });

    const result = await Token.unseal(`stseal.v1.${"a".repeat(64)}`);

    logTestStep("token-options.max-size-before-parse", {
      maxTokenSize: 32,
      result: summarizeResult(result)
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.code).toBe("token_too_large");
    }
  });

  it("does not seal tokens that exceed maxTokenSize", async () => {
    const key = generateSealKey();

    const sealer = createSealer({
      issuer: "my-app",
      keys: {
        "2026-05": key
      },
      currentKeyId: "2026-05"
    });

    const Token = sealer.defineToken<{ userId: string }>({
      purpose: "session",
      ttl: "1h",
      audience: "web",
      maxTokenSize: 32
    });

    logTestStep("token-options.max-size-seal", {
      maxTokenSize: 32,
      expectedCode: "token_too_large"
    });

    await expect(Token.seal({ userId: "user_123" })).rejects.toMatchObject({
      code: "token_too_large"
    });
  });

  it("accepts recently expired tokens within clockTolerance", async () => {
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
      audience: "web",
      clockTolerance: "1s"
    });

    const token = await Token.seal({ userId: "user_123" });

    now = 2500;

    const withinTolerance = await Token.unsealOrNull(token);

    logTestStep("token-options.clock-tolerance.accepted", {
      token: summarizeToken(token),
      now,
      payload: withinTolerance
    });

    expect(withinTolerance).toEqual({
      userId: "user_123"
    });

    now = 3100;

    const result = await Token.unseal(token);

    logTestStep("token-options.clock-tolerance.expired", {
      now,
      result: summarizeResult(result)
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.code).toBe("expired");
    }
  });

  it("accepts explicit zero clockTolerance", async () => {
    const key = generateSealKey();

    const sealer = createSealer({
      issuer: "my-app",
      keys: {
        "2026-05": key
      },
      currentKeyId: "2026-05"
    });

    const Token = sealer.defineToken<{ userId: string }>({
      purpose: "session",
      ttl: "1h",
      audience: "web",
      clockTolerance: 0
    });

    const token = await Token.seal({ userId: "user_123" });

    const payload = await Token.unsealOrNull(token);

    logTestStep("token-options.zero-clock-tolerance", {
      token: summarizeToken(token),
      payload
    });

    expect(payload).toEqual({
      userId: "user_123"
    });
  });

  it("rejects tokens before notBefore and accepts them within tolerance", async () => {
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
      ttl: "1h",
      audience: "web",
      clockTolerance: "1s"
    });

    const token = await Token.seal(
      { userId: "user_123" },
      { notBefore: "5s" }
    );

    now = 4500;

    const early = await Token.unseal(token);

    logTestStep("token-options.not-before.early", {
      token: summarizeToken(token),
      now,
      result: summarizeResult(early)
    });

    expect(early.ok).toBe(false);

    if (!early.ok) {
      expect(early.code).toBe("not_yet_valid");
    }

    now = 5500;

    const valid = await Token.unseal(token);

    logTestStep("token-options.not-before.valid", {
      now,
      result: summarizeResult(valid)
    });

    expect(valid.ok).toBe(true);

    if (valid.ok) {
      expect(valid.meta.notBefore).toBe(6000);
    }
  });

  it("throws a SealError for invalid seal options", async () => {
    const key = generateSealKey();

    const sealer = createSealer({
      issuer: "my-app",
      keys: {
        "2026-05": key
      },
      currentKeyId: "2026-05"
    });

    const Token = sealer.defineToken<{ userId: string }>({
      purpose: "session",
      ttl: "1h",
      audience: "web"
    });

    logTestStep("token-options.invalid-seal-options", {
      notBefore: "soon",
      expectedError: "SealError"
    });

    await expect(
      Token.seal({ userId: "user_123" }, { notBefore: "soon" })
    ).rejects.toBeInstanceOf(SealError);
  });
});
