import { describe, expect, it } from "vitest";
import { createSealer, generateSealKey } from "../src";

describe("seal and unseal", () => {
  it("seals and unseals a payload", async () => {
    const key = generateSealKey();

    const sealer = createSealer({
      issuer: "my-app",
      keys: {
        "2026-05": key
      },
      currentKeyId: "2026-05"
    });

    const PasswordResetToken = sealer.defineToken<{ userId: string }>({
      purpose: "password-reset",
      ttl: "15m",
      audience: "web"
    });

    const token = await PasswordResetToken.seal({
      userId: "user_123"
    });

    expect(token.startsWith("stseal.v1.")).toBe(true);

    const result = await PasswordResetToken.unseal(token);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.payload.userId).toBe("user_123");
      expect(result.meta.purpose).toBe("password-reset");
      expect(result.meta.issuer).toBe("my-app");
      expect(result.meta.audience).toBe("web");
      expect(result.meta.keyId).toBe("2026-05");
    }
  });

  it("creates different tokens for the same payload", async () => {
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
      ttl: "1h",
      audience: "web"
    });

    const tokenA = await SessionToken.seal({ userId: "user_123" });
    const tokenB = await SessionToken.seal({ userId: "user_123" });

    expect(tokenA).not.toBe(tokenB);
  });
});