import { describe, expect, it } from "vitest";
import { createSealer, generateSealKey } from "../src";

describe("inspect", () => {
  it("reads token metadata without unsealing payload", async () => {
    const key = generateSealKey();

    const sealer = createSealer({
      issuer: "my-app",
      keys: {
        "2026-05": key
      },
      currentKeyId: "2026-05"
    });

    const Token = sealer.defineToken<{ userId: string }>({
      purpose: "password-reset",
      ttl: "15m",
      audience: "web"
    });

    const token = await Token.seal({ userId: "user_123" });
    const meta = Token.inspect(token);

    expect(meta).toEqual({
      version: "v1",
      algorithm: "A256GCM",
      keyId: "2026-05",
      purpose: "password-reset",
      issuer: "my-app",
      audience: "web"
    });
  });
});