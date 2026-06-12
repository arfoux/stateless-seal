import { describe, expect, it } from "vitest";
import { createSealer, generateSealKey } from "../src";
import { logTestStep, summarizeToken } from "./debug-log";

describe("unsealOrNull", () => {
  it("returns the payload for a valid token", async () => {
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
    const payload = await Token.unsealOrNull(token);

    logTestStep("unseal-or-null.valid", {
      token: summarizeToken(token),
      payload
    });

    expect(payload).toEqual({ userId: "user_123" });
  });

  it("returns null for an invalid token", async () => {
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

    const payload = await Token.unsealOrNull("not-a-token");

    logTestStep("unseal-or-null.invalid", {
      input: "not-a-token",
      payload
    });

    expect(payload).toBeNull();
  });
});
