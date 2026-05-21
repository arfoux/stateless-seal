export { createSealer } from "./core/create-sealer";
export { SealError } from "./core/errors";
export { generateSealKey } from "./crypto/keys";
export { clearCookie, getCookie, parseCookies, serializeCookie } from "./cookie";

export type {
  DurationInput,
  Keyring,
  SealKeyInput,
  SealerConfig,
  SealOptions,
  TokenPolicy,
  TokenDefinition,
  TokenHeader,
  TokenMeta,
  TokenSchema,
  SealErrorCode,
  UnsealResult
} from "./core/types";

export type { CookieOptions, CookieSameSite } from "./cookie";
