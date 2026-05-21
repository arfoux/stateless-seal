import { aesGcmDecrypt, aesGcmEncrypt } from "../crypto/aes-gcm";
import { importAesGcmKey } from "../crypto/keys";
import { randomBytes } from "../crypto/random";
import type {
  DurationInput,
  EncryptedTokenBody,
  SealOptions,
  SealerConfig,
  TokenHeader,
  TokenDefinition,
  TokenMeta,
  TokenPolicy,
  UnsealResult
} from "./types";
import { encodeToken, createAad, parseToken } from "../token/format";
import { base64urlEncodeJson } from "../token/base64url";
import { parseTtl } from "../policy/ttl";
import { inspectToken } from "../token/inspect";
import { fail, SealError } from "./errors";
import { validatePayload } from "./schema";

export function defineToken<TPayload>(
  config: Required<Pick<SealerConfig, "issuer" | "keys" | "currentKeyId">> & {
    clock: () => number;
  },
  policy: TokenPolicy<TPayload>
): TokenDefinition<TPayload> {
  const parsedPolicy = validatePolicy(policy);

  return {
    async seal(payload: TPayload, options: SealOptions = {}): Promise<string> {
      const now = config.clock();
      const validatedPayload = validatePayload(policy.schema, payload);

      if (!validatedPayload.ok) {
        throw new SealError(
          "schema_validation_failed",
          "Payload failed schema validation."
        );
      }

      const keyInput = config.keys[config.currentKeyId];

      if (!keyInput) {
        throw new SealError("unknown_kid", "Current key id does not exist.");
      }

      const key = await importAesGcmKey(keyInput);

      const header: TokenHeader = {
        alg: "A256GCM",
        kid: config.currentKeyId,
        pur: policy.purpose,
        iss: config.issuer,
        ...(policy.audience ? { aud: policy.audience } : {})
      };

      const body: EncryptedTokenBody<TPayload> = {
        iat: now,
        exp: now + parsedPolicy.ttlMs,
        ...resolveNotBefore(now, parsedPolicy.notBeforeMs, options),
        data: validatedPayload.payload
      };

      const headerB64 = base64urlEncodeJson(header);
      const aad = createAad(headerB64);

      const iv = randomBytes(12);
      const plaintext = new TextEncoder().encode(JSON.stringify(body));

      const ciphertext = await aesGcmEncrypt({
        key,
        iv,
        plaintext,
        aad
      });

      const token = encodeToken({
        header,
        iv,
        ciphertext
      });

      if (
        policy.maxTokenSize !== undefined &&
        token.length > policy.maxTokenSize
      ) {
        throw new SealError("token_too_large", "Token exceeds maxTokenSize.");
      }

      return token;
    },

    async unseal(token: string): Promise<UnsealResult<TPayload>> {
      if (
        policy.maxTokenSize !== undefined &&
        token.length > policy.maxTokenSize
      ) {
        return fail("token_too_large");
      }

      const parsed = parseToken(token);

      if (!parsed) {
        return fail("malformed_token");
      }

      if (parsed.header.alg !== "A256GCM") {
        return fail("unsupported_algorithm");
      }

      if (parsed.header.pur !== policy.purpose) {
        return fail("purpose_mismatch");
      }

      if (parsed.header.iss !== config.issuer) {
        return fail("issuer_mismatch");
      }

      if (policy.audience && parsed.header.aud !== policy.audience) {
        return fail("audience_mismatch");
      }

      const keyInput = config.keys[parsed.header.kid];

      if (!keyInput) {
        return fail("unknown_kid");
      }

      const key = await importAesGcmKey(keyInput);
      const aad = createAad(parsed.headerB64);

      let body: EncryptedTokenBody<TPayload>;

      try {
        const plaintext = await aesGcmDecrypt({
          key,
          iv: parsed.iv,
          ciphertext: parsed.ciphertext,
          aad
        });

        body = JSON.parse(
          new TextDecoder().decode(plaintext)
        ) as EncryptedTokenBody<TPayload>;
      } catch {
        return fail("decrypt_failed");
      }

      const now = config.clock();

      if (
        typeof body.exp !== "number" ||
        now - parsedPolicy.clockToleranceMs > body.exp
      ) {
        return fail("expired");
      }

      if (
        body.nbf !== undefined &&
        (typeof body.nbf !== "number" ||
          now + parsedPolicy.clockToleranceMs < body.nbf)
      ) {
        return fail("not_yet_valid");
      }

      const payload = validatePayload(policy.schema, body.data);

      if (!payload.ok) {
        return fail("schema_validation_failed");
      }

      const meta: TokenMeta = {
        version: "v1",
        algorithm: parsed.header.alg,
        keyId: parsed.header.kid,
        purpose: parsed.header.pur,
        issuer: parsed.header.iss,
        issuedAt: body.iat,
        expiresAt: body.exp,
        ...(body.nbf !== undefined ? { notBefore: body.nbf } : {}),
        ...(parsed.header.aud ? { audience: parsed.header.aud } : {})
      };

      return {
        ok: true,
        payload: payload.payload,
        meta
      };
    },

    async unsealOrThrow(token: string): Promise<TPayload> {
      const result = await this.unseal(token);

      if (!result.ok) {
        throw new SealError(result.code);
      }

      return result.payload;
    },

    async unsealOrNull(token: string): Promise<TPayload | null> {
      const result = await this.unseal(token);

      if (!result.ok) {
        return null;
      }

      return result.payload;
    },

    inspect(token: string) {
      return inspectToken(token);
    }
  };
}

function validatePolicy(policy: TokenPolicy<unknown>) {
  if (!policy.purpose || typeof policy.purpose !== "string") {
    throw new SealError("invalid_policy", "Token purpose is required.");
  }

  if (!policy.ttl) {
    throw new SealError("invalid_policy", "Token ttl is required.");
  }

  const ttlMs = parsePolicyDuration(policy.ttl, "ttl");
  const clockToleranceMs =
    policy.clockTolerance === undefined
      ? 0
      : parsePolicyDuration(policy.clockTolerance, "clockTolerance", {
          allowZero: true
        });

  if (
    policy.maxTokenSize !== undefined &&
    (!Number.isInteger(policy.maxTokenSize) || policy.maxTokenSize <= 0)
  ) {
    throw new SealError(
      "invalid_policy",
      "maxTokenSize must be a positive integer."
    );
  }

  if (policy.notBefore === undefined) {
    return {
      ttlMs,
      clockToleranceMs
    };
  }

  return {
    ttlMs,
    clockToleranceMs,
    notBeforeMs: parsePolicyDuration(policy.notBefore, "notBefore", {
      allowZero: true
    })
  };
}

function resolveNotBefore(
  now: number,
  policyNotBeforeMs: number | undefined,
  options: SealOptions
): { nbf?: number } {
  if (options.notBefore !== undefined) {
    return {
      nbf:
        now +
        parseSealOptionDuration(options.notBefore, "notBefore", {
          allowZero: true
        })
    };
  }

  if (policyNotBeforeMs === undefined) {
    return {};
  }

  return {
    nbf: now + policyNotBeforeMs
  };
}

function parsePolicyDuration(
  value: DurationInput,
  name: string,
  options: { allowZero?: boolean } = {}
): number {
  try {
    return parseDuration(value, options);
  } catch {
    throw new SealError("invalid_policy", `${name} must be a valid duration.`);
  }
}

function parseSealOptionDuration(
  value: DurationInput,
  name: string,
  options: { allowZero?: boolean } = {}
): number {
  try {
    return parseDuration(value, options);
  } catch {
    throw new SealError("invalid_options", `${name} must be a valid duration.`);
  }
}

function parseDuration(
  value: DurationInput,
  options: { allowZero?: boolean }
): number {
  if (options.allowZero && value === 0) {
    return 0;
  }

  return parseTtl(value);
}
