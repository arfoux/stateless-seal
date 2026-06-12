import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createSealer } from "../src";
import type { Keyring, SealErrorCode, TokenMeta } from "../src";
import { logTestStep, summarizeResult, summarizeToken } from "./debug-log";

type Vector = {
  name: string;
  token: string;
  verify: {
    issuer: string;
    purpose: string;
    audience?: string;
    now: number;
    keys: Keyring;
    currentKeyId: string;
  };
  expected:
    | {
        ok: true;
        payload: unknown;
        meta?: TokenMeta;
      }
    | {
        ok: false;
        code: SealErrorCode;
      };
};

const vectorDir = join("test-vectors", "v1");

function loadVectors(): Vector[] {
  return readdirSync(vectorDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => {
      const path = join(vectorDir, file);
      return JSON.parse(readFileSync(path, "utf8")) as Vector;
    });
}

describe("v1 test vectors", () => {
  for (const vector of loadVectors()) {
    it(vector.name, async () => {
      const sealer = createSealer({
        issuer: vector.verify.issuer,
        keys: vector.verify.keys,
        currentKeyId: vector.verify.currentKeyId,
        clock: () => vector.verify.now
      });

      const Token = sealer.defineToken({
        purpose: vector.verify.purpose,
        ttl: "1h",
        ...(vector.verify.audience
          ? { audience: vector.verify.audience }
          : {})
      });

      const result = await Token.unseal(vector.token);

      logTestStep("test-vector.verify", {
        name: vector.name,
        token: summarizeToken(vector.token),
        expected: vector.expected,
        result: summarizeResult(result)
      });

      expect(result.ok).toBe(vector.expected.ok);

      if (vector.expected.ok) {
        expect(result.ok).toBe(true);

        if (result.ok) {
          expect(result.payload).toEqual(vector.expected.payload);

          if (vector.expected.meta) {
            expect(result.meta).toEqual(vector.expected.meta);
          }
        }
      } else {
        expect(result.ok).toBe(false);

        if (!result.ok) {
          expect(result.code).toBe(vector.expected.code);
        }
      }
    });
  }
});
