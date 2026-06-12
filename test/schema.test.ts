import { describe, expect, expectTypeOf, it } from "vitest";
import { createSealer, generateSealKey } from "../src";
import { logTestStep, summarizeResult, summarizeToken } from "./debug-log";

type SessionPayload = {
  userId: string;
  role: "user" | "admin";
};

describe("schema validation", () => {
  it("validates decrypted payloads with a parse schema", async () => {
    const key = generateSealKey();

    const sealer = createSealer({
      issuer: "my-app",
      keys: {
        "2026-05": key
      },
      currentKeyId: "2026-05"
    });

    const SessionToken = sealer.defineToken({
      purpose: "session",
      ttl: "1h",
      audience: "web",
      schema: {
        parse(input: unknown): SessionPayload {
          if (!input || typeof input !== "object") {
            throw new Error("Invalid payload.");
          }

          const value = input as Record<string, unknown>;

          if (
            typeof value.userId !== "string" ||
            (value.role !== "user" && value.role !== "admin")
          ) {
            throw new Error("Invalid payload.");
          }

          return {
            userId: value.userId,
            role: value.role
          };
        }
      }
    });

    const token = await SessionToken.seal({
      userId: "user_123",
      role: "admin"
    });

    const result = await SessionToken.unseal(token);

    logTestStep("schema.parse.roundtrip", {
      token: summarizeToken(token),
      result: summarizeResult(result)
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expectTypeOf(result.payload).toEqualTypeOf<SessionPayload>();
      expect(result.payload.role).toBe("admin");
    }
  });

  it("supports Zod-compatible safeParse schemas without a Zod dependency", async () => {
    const key = generateSealKey();

    const sealer = createSealer({
      issuer: "my-app",
      keys: {
        "2026-05": key
      },
      currentKeyId: "2026-05"
    });

    const zodLikeSchema = {
      safeParse(input: unknown):
        | { success: true; data: SessionPayload }
        | { success: false; error: Error } {
        if (!input || typeof input !== "object") {
          return {
            success: false,
            error: new Error("Invalid payload.")
          };
        }

        const value = input as Record<string, unknown>;

        if (
          typeof value.userId !== "string" ||
          (value.role !== "user" && value.role !== "admin")
        ) {
          return {
            success: false,
            error: new Error("Invalid payload.")
          };
        }

        return {
          success: true,
          data: {
            userId: value.userId,
            role: value.role
          }
        };
      }
    };

    const SessionToken = sealer.defineToken({
      purpose: "session",
      ttl: "1h",
      audience: "web",
      schema: zodLikeSchema
    });

    const token = await SessionToken.seal({
      userId: "user_123",
      role: "user"
    });

    const result = await SessionToken.unseal(token);

    logTestStep("schema.safe-parse.roundtrip", {
      token: summarizeToken(token),
      result: summarizeResult(result)
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expectTypeOf(result.payload).toEqualTypeOf<SessionPayload>();
      expect(result.payload.userId).toBe("user_123");
    }
  });

  it("rejects payloads that fail schema validation while sealing", async () => {
    const key = generateSealKey();

    const sealer = createSealer({
      issuer: "my-app",
      keys: {
        "2026-05": key
      },
      currentKeyId: "2026-05"
    });

    const SessionToken = sealer.defineToken({
      purpose: "session",
      ttl: "1h",
      audience: "web",
      schema: {
        safeParse(input: unknown):
          | { success: true; data: SessionPayload }
          | { success: false; error: Error } {
          if (
            input &&
            typeof input === "object" &&
            typeof (input as Record<string, unknown>).userId === "string" &&
            ((input as Record<string, unknown>).role === "user" ||
              (input as Record<string, unknown>).role === "admin")
          ) {
            return {
              success: true,
              data: input as SessionPayload
            };
          }

          return {
            success: false,
            error: new Error("Invalid payload.")
          };
        }
      }
    });

    logTestStep("schema.reject-while-sealing", {
      payload: {
        userId: "user_123",
        role: "owner"
      },
      expectedCode: "schema_validation_failed"
    });

    await expect(
      SessionToken.seal({
        userId: "user_123",
        role: "owner"
      } as never)
    ).rejects.toMatchObject({
      code: "schema_validation_failed"
    });
  });

  it("rejects payloads that fail schema validation", async () => {
    const key = generateSealKey();

    const sealer = createSealer({
      issuer: "my-app",
      keys: {
        "2026-05": key
      },
      currentKeyId: "2026-05"
    });

    const LooseToken = sealer.defineToken<{ userId: number }>({
      purpose: "session",
      ttl: "1h",
      audience: "web"
    });

    const StrictToken = sealer.defineToken({
      purpose: "session",
      ttl: "1h",
      audience: "web",
      schema: {
        safeParse(input: unknown):
          | { success: true; data: { userId: string } }
          | { success: false; error: Error } {
          const userId =
            input && typeof input === "object"
              ? (input as Record<string, unknown>).userId
              : undefined;

          if (typeof userId === "string") {
            return {
              success: true,
              data: {
                userId
              }
            };
          }

          return {
            success: false,
            error: new Error("Invalid payload.")
          };
        }
      }
    });

    const token = await LooseToken.seal({ userId: 123 });
    const result = await StrictToken.unseal(token);

    logTestStep("schema.reject-after-decrypt", {
      token: summarizeToken(token),
      result: summarizeResult(result)
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.code).toBe("schema_validation_failed");
    }
  });
});
