import { describe, expect, it } from "vitest";
import { createSealer, generateSealKey } from "../src";

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

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.code).toBe("unknown_kid");
    }
  });
});