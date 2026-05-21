export type SealKeyInput = string | Uint8Array | CryptoKey;

export type Keyring = Record<string, SealKeyInput>;

export type SealerConfig = {
  issuer: string;
  keys: Keyring;
  currentKeyId: string;
  clock?: () => number;
};

export type TokenPolicy = {
  purpose: string;
  ttl: string | number;
  audience?: string;
};

export type TokenHeader = {
  alg: "A256GCM";
  kid: string;
  pur: string;
  iss: string;
  aud?: string;
};

export type EncryptedTokenBody<TPayload> = {
  iat: number;
  exp: number;
  data: TPayload;
};

export type TokenMeta = {
  version: "v1";
  algorithm: "A256GCM";
  keyId: string;
  purpose: string;
  issuer: string;
  audience?: string;
  issuedAt?: number;
  expiresAt?: number;
};

export type SealErrorCode =
  | "invalid_config"
  | "invalid_policy"
  | "malformed_token"
  | "unsupported_version"
  | "unsupported_algorithm"
  | "unknown_kid"
  | "decrypt_failed"
  | "expired"
  | "purpose_mismatch"
  | "issuer_mismatch"
  | "audience_mismatch";

export type UnsealResult<TPayload> =
  | {
      ok: true;
      payload: TPayload;
      meta: TokenMeta;
    }
  | {
      ok: false;
      code: SealErrorCode;
    };

export type ParsedToken = {
  prefix: "stseal";
  version: "v1";
  header: TokenHeader;
  headerB64: string;
  iv: Uint8Array;
  ciphertext: Uint8Array;
};