import { describe, expect, it } from "vitest";
import { createSealer, generateSealKey } from "../src";
import {
  base64urlEncode,
  base64urlEncodeJson
} from "../src/token/base64url";
import { logTestStep } from "./debug-log";

describe("malformed tokens", () => {
  it("returns malformed_token for malformed inputs without throwing", async () => {
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

    const validHeader = base64urlEncodeJson({
      alg: "A256GCM",
      kid: "2026-05",
      pur: "session",
      iss: "my-app"
    });
    const invalidJson = base64urlEncode(new TextEncoder().encode("{"));
    const invalidHeaderShape = base64urlEncodeJson({
      alg: "A256GCM",
      kid: 123,
      pur: "session",
      iss: "my-app"
    });
    const invalidHeaderChars = base64urlEncodeJson({
      alg: "A256GCM",
      kid: "2026-05",
      pur: "bad purpose",
      iss: "my-app"
    });
    const shortIv = base64urlEncode(new Uint8Array([1, 2, 3]));
    const validIv = base64urlEncode(new Uint8Array(12));
    const ciphertext = base64urlEncode(new Uint8Array([1, 2, 3, 4]));

    const inputs = [
      "",
      ".",
      "stseal",
      "stseal.v1",
      "stseal.v1.a.b.c",
      "other.v1.a.b.c",
      "stseal.v2.a.b.c",
      `stseal.v1.abc*.${validIv}.${ciphertext}`,
      `stseal.v1.${invalidJson}.${validIv}.${ciphertext}`,
      `stseal.v1.${invalidHeaderShape}.${validIv}.${ciphertext}`,
      `stseal.v1.${invalidHeaderChars}.${validIv}.${ciphertext}`,
      `stseal.v1.${validHeader}.${shortIv}.${ciphertext}`,
      `stseal.v1.${validHeader}.${validIv}.`,
      `stseal.v1.${validHeader}.${validIv}.abc*`
    ];
    const codes = new Set<string>();

    for (const input of inputs) {
      const result = await Token.unseal(input);

      expect(result.ok, input).toBe(false);

      if (!result.ok) {
        codes.add(result.code);
        expect(result.code, input).toBe("malformed_token");
      }
    }

    logTestStep("malformed-token.inputs", {
      checked: inputs.length,
      observedCodes: [...codes]
    });
  });
});
