import { aesGcmDecrypt, aesGcmEncrypt } from "../crypto/aes-gcm";
import { importAesGcmKey } from "../crypto/keys";
import { randomBytes } from "../crypto/random";
import type {
  EncryptedTokenBody,
  SealerConfig,
  TokenHeader,
  TokenMeta,
  TokenPolicy,
  UnsealResult
} from "./types";
import { encodeToken, createAad, parseToken } from "../token/format";
import { base64urlEncodeJson } from "../token/base64url";
import { parseTtl } from "../policy/ttl";
import { inspectToken } from "../token/inspect";
import { fail, SealError } from "./errors";

export function defineToken<TPayload>(
  config: Required<Pick<SealerConfig, "issuer" | "keys" | "currentKeyId">> & {
    clock: () => number;
  },
  policy: TokenPolicy
) {
  validatePolicy(policy);

  return {
    async seal(payload: TPayload): Promise<string> {
      const now = config.clock();
      const ttlMs = parseTtl(policy.ttl);

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
        exp: now + ttlMs,
        data: payload
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

      return encodeToken({
        header,
        iv,
        ciphertext
      });
    },

    async unseal(token: string): Promise<UnsealResult<TPayload>> {
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

      if (typeof body.exp !== "number" || now > body.exp) {
        return fail("expired");
      }

      const meta: TokenMeta = {
  version: "v1",
  algorithm: parsed.header.alg,
  keyId: parsed.header.kid,
  purpose: parsed.header.pur,
  issuer: parsed.header.iss,
  issuedAt: body.iat,
  expiresAt: body.exp,
  ...(parsed.header.aud ? { audience: parsed.header.aud } : {})
};

      return {
        ok: true,
        payload: body.data,
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

    inspect(token: string) {
      return inspectToken(token);
    }
  };
}

function validatePolicy(policy: TokenPolicy) {
  if (!policy.purpose || typeof policy.purpose !== "string") {
    throw new SealError("invalid_policy", "Token purpose is required.");
  }

  if (!policy.ttl) {
    throw new SealError("invalid_policy", "Token ttl is required.");
  }
}