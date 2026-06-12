import { describe, expect, it } from "vitest";
import { createSealer, generateSealKey } from "../src";
import { logTestStep, summarizeResult, summarizeToken } from "./debug-log";

describe("key rotation", () => {
  it("can unseal old token with old key still in keyring", async () => {
    const oldKey = generateSealKey();
    const newKey = generateSealKey();

    const oldSealer = createSealer({
      issuer: "my-app",
      keys: {
        "2026-04": oldKey
      },
      currentKeyId: "2026-04",
      clock: () => 1000
    });

    const OldToken = oldSealer.defineToken<{ userId: string }>({
      purpose: "session",
      ttl: "1h",
      audience: "web"
    });

    const oldToken = await OldToken.seal({ userId: "user_123" });

    const newSealer = createSealer({
      issuer: "my-app",
      keys: {
        "2026-05": newKey,
        "2026-04": oldKey
      },
      currentKeyId: "2026-05",
      clock: () => 2000
    });

    const NewToken = newSealer.defineToken<{ userId: string }>({
      purpose: "session",
      ttl: "1h",
      audience: "web"
    });

    const result = await NewToken.unseal(oldToken);

    logTestStep("key-rotation.old-key-still-valid", {
      token: summarizeToken(oldToken),
      availableKeyIds: ["2026-05", "2026-04"],
      result: summarizeResult(result)
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.payload.userId).toBe("user_123");
      expect(result.meta.keyId).toBe("2026-04");
    }
  });

  it("rejects old token when old key is removed", async () => {
    const oldKey = generateSealKey();
    const newKey = generateSealKey();

    const oldSealer = createSealer({
      issuer: "my-app",
      keys: {
        "2026-04": oldKey
      },
      currentKeyId: "2026-04"
    });

    const OldToken = oldSealer.defineToken<{ userId: string }>({
      purpose: "session",
      ttl: "1h",
      audience: "web"
    });

    const oldToken = await OldToken.seal({ userId: "user_123" });

    const newSealer = createSealer({
      issuer: "my-app",
      keys: {
        "2026-05": newKey
      },
      currentKeyId: "2026-05"
    });

    const NewToken = newSealer.defineToken<{ userId: string }>({
      purpose: "session",
      ttl: "1h",
      audience: "web"
    });

    const result = await NewToken.unseal(oldToken);

    logTestStep("key-rotation.old-key-removed", {
      token: summarizeToken(oldToken),
      availableKeyIds: ["2026-05"],
      result: summarizeResult(result)
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.code).toBe("unknown_kid");
    }
  });
});
