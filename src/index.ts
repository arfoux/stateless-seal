export { createSealer } from "./core/create-sealer";
export { SealError } from "./core/errors";
export { generateSealKey } from "./crypto/keys";

export type {
  Keyring,
  SealKeyInput,
  SealerConfig,
  TokenPolicy,
  TokenHeader,
  TokenMeta,
  SealErrorCode,
  UnsealResult
} from "./core/types";