export type SealKeyInput = string | Uint8Array | CryptoKey;

export type Keyring = Record<string, SealKeyInput>;
export type DurationInput = string | number;

export type SealerConfig = {
  issuer: string;
  keys: Keyring;
  currentKeyId: string;
  maxTokenSize?: number;
  clock?: () => number;
};

export type SchemaParseResult<TPayload> =
  | {
      success: true;
      data: TPayload;
    }
  | {
      success: false;
      error?: unknown;
    };

export type TokenSchema<TPayload> =
  | {
      safeParse(input: unknown): SchemaParseResult<TPayload>;
    }
  | {
      parse(input: unknown): TPayload;
    }
  | ((input: unknown) => TPayload);

export type TokenPolicy<TPayload = unknown> = {
  purpose: string;
  ttl: DurationInput;
  audience?: string;
  schema?: TokenSchema<TPayload>;
  maxTokenSize?: number;
  clockTolerance?: DurationInput;
  notBefore?: DurationInput;
};

export type SealOptions = {
  notBefore?: DurationInput;
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
  nbf?: number;
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
  notBefore?: number;
};

export type SealErrorCode =
  | "invalid_config"
  | "invalid_policy"
  | "invalid_options"
  | "invalid_key"
  | "malformed_token"
  | "unsupported_version"
  | "unsupported_algorithm"
  | "unknown_kid"
  | "decrypt_failed"
  | "expired"
  | "not_yet_valid"
  | "token_too_large"
  | "schema_validation_failed"
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

export type TokenDefinition<TPayload> = {
  seal(payload: TPayload, options?: SealOptions): Promise<string>;
  unseal(token: string): Promise<UnsealResult<TPayload>>;
  unsealOrThrow(token: string): Promise<TPayload>;
  unsealOrNull(token: string): Promise<TPayload | null>;
  inspect(token: string): TokenMeta | null;
};
