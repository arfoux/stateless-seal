import { describe, expect, it } from "vitest";
import { createSealer, generateSealKey } from "../src";

describe("tamper protection", () => {
it("rejects tampered ciphertext", async () => {
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

  const token = await Token.seal({ userId: "user_123" });
  const parts = token.split(".");

  const ciphertext = parts[4]!;

  parts[4] =
    (ciphertext[0] === "A" ? "B" : "A") + ciphertext.slice(1);

  const tampered = parts.join(".");
  const result = await Token.unseal(tampered);

  expect(result.ok).toBe(false);

  if (!result.ok) {
    expect(result.code).toBe("decrypt_failed");
  }
});

  it("rejects token used with the wrong purpose", async () => {
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

    const PasswordResetToken = sealer.defineToken<{ userId: string }>({
      purpose: "password-reset",
      ttl: "15m",
      audience: "web"
    });

    const token = await SessionToken.seal({ userId: "user_123" });
    const result = await PasswordResetToken.unseal(token);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.code).toBe("purpose_mismatch");
    }
  });

  it("rejects token used with the wrong audience", async () => {
    const key = generateSealKey();

    const sealer = createSealer({
      issuer: "my-app",
      keys: {
        "2026-05": key
      },
      currentKeyId: "2026-05"
    });

    const WebToken = sealer.defineToken<{ userId: string }>({
      purpose: "session",
      ttl: "1h",
      audience: "web"
    });

    const ApiToken = sealer.defineToken<{ userId: string }>({
      purpose: "session",
      ttl: "1h",
      audience: "api"
    });

    const token = await WebToken.seal({ userId: "user_123" });
    const result = await ApiToken.unseal(token);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.code).toBe("audience_mismatch");
    }
  });
});