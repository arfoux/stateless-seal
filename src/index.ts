export { DEFAULT_MAX_TOKEN_SIZE, createSealer } from "./core/create-sealer";
export { SealError } from "./core/errors";
export { generateSealKey } from "./crypto/keys";
export { clearCookie, getCookie, parseCookies, serializeCookie } from "./cookie";
export { memoryReplayStore } from "./replay/memory";

export type {
  DurationInput,
  Keyring,
  SealKeyInput,
  SealerConfig,
  SealOptions,
  ReplayStore,
  ReplayStoreConsumeResult,
  UnsealOnceOptions,
  TokenPolicy,
  TokenDefinition,
  TokenHeader,
  TokenMeta,
  TokenSchema,
  SealErrorCode,
  UnsealResult
} from "./core/types";

export type { CookieOptions, CookieSameSite } from "./cookie";
export type { MemoryReplayStoreOptions } from "./replay/memory";
