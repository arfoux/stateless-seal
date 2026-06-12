import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_TOKEN_SIZE,
  createSealer,
  generateSealKey
} from "../src";
import { logTestStep, summarizeResult } from "./debug-log";

describe("hardening", () => {
  it("rejects invalid issuer and key identifiers", () => {
    const key = generateSealKey();

    logTestStep("hardening.invalid-config-identifiers", {
      invalidIssuer: "my app",
      invalidKeyId: "bad key"
    });

    expect(() =>
      createSealer({
        issuer: "my app",
        keys: {
          "2026-05": key
        },
        currentKeyId: "2026-05"
      })
    ).toThrow(/Issuer/);

    expect(() =>
      createSealer({
        issuer: "my-app",
        keys: {
          "bad key": key
        },
        currentKeyId: "bad key"
      })
    ).toThrow(/currentKeyId/);
  });

  it("rejects invalid purpose and audience identifiers", () => {
    const key = generateSealKey();

    const sealer = createSealer({
      issuer: "my-app",
      keys: {
        "2026-05": key
      },
      currentKeyId: "2026-05"
    });

    logTestStep("hardening.invalid-policy-identifiers", {
      invalidPurpose: "Password Reset",
      invalidAudience: "web app"
    });

    expect(() =>
      sealer.defineToken({
        purpose: "Password Reset",
        ttl: "15m"
      })
    ).toThrow(/purpose/);

    expect(() =>
      sealer.defineToken({
        purpose: "password-reset",
        ttl: "15m",
        audience: "web app"
      })
    ).toThrow(/audience/);
  });

  it("uses a default max token size", async () => {
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
      ttl: "1h"
    });

    const token = `stseal.v1.${"a".repeat(DEFAULT_MAX_TOKEN_SIZE)}`;
    const result = await Token.unseal(token);

    logTestStep("hardening.default-max-token-size", {
      defaultMaxTokenSize: DEFAULT_MAX_TOKEN_SIZE,
      attemptedLength: token.length,
      result: summarizeResult(result)
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.code).toBe("token_too_large");
    }
  });

  it("allows a sealer maxTokenSize and a smaller policy maxTokenSize", async () => {
    const key = generateSealKey();

    const sealer = createSealer({
      issuer: "my-app",
      keys: {
        "2026-05": key
      },
      currentKeyId: "2026-05",
      maxTokenSize: 128
    });

    const Token = sealer.defineToken<{ userId: string }>({
      purpose: "session",
      ttl: "1h",
      maxTokenSize: 64
    });

    const result = await Token.unseal(`stseal.v1.${"a".repeat(65)}`);

    logTestStep("hardening.policy-max-token-size", {
      sealerMaxTokenSize: 128,
      policyMaxTokenSize: 64,
      result: summarizeResult(result)
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.code).toBe("token_too_large");
    }
  });

  it("rejects a policy maxTokenSize larger than the sealer limit", () => {
    const key = generateSealKey();

    const sealer = createSealer({
      issuer: "my-app",
      keys: {
        "2026-05": key
      },
      currentKeyId: "2026-05",
      maxTokenSize: 128
    });

    logTestStep("hardening.policy-limit-overflow", {
      sealerMaxTokenSize: 128,
      policyMaxTokenSize: 256
    });

    expect(() =>
      sealer.defineToken({
        purpose: "session",
        ttl: "1h",
        maxTokenSize: 256
      })
    ).toThrow(/cannot exceed/);
  });

  it("throws invalid_key when sealing with an invalid current key", async () => {
    const sealer = createSealer({
      issuer: "my-app",
      keys: {
        "2026-05": "abc"
      },
      currentKeyId: "2026-05"
    });

    const Token = sealer.defineToken<{ userId: string }>({
      purpose: "session",
      ttl: "1h"
    });

    logTestStep("hardening.invalid-current-key", {
      keyId: "2026-05",
      expectedCode: "invalid_key"
    });

    await expect(Token.seal({ userId: "user_123" })).rejects.toMatchObject({
      code: "invalid_key"
    });
  });

  it("returns invalid_key when unsealing with an invalid keyring entry", async () => {
    const goodKey = generateSealKey();

    const issuer = "my-app";
    const policy = {
      purpose: "session",
      ttl: "1h"
    };

    const goodSealer = createSealer({
      issuer,
      keys: {
        "2026-05": goodKey
      },
      currentKeyId: "2026-05"
    });

    const Token = goodSealer.defineToken<{ userId: string }>(policy);
    const token = await Token.seal({ userId: "user_123" });

    const badSealer = createSealer({
      issuer,
      keys: {
        "2026-05": "abc"
      },
      currentKeyId: "2026-05"
    });

    const BadToken = badSealer.defineToken<{ userId: string }>(policy);
    const result = await BadToken.unseal(token);

    logTestStep("hardening.invalid-unseal-key", summarizeResult(result));

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.code).toBe("invalid_key");
    }
  });
});
