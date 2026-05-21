import type { SealErrorCode } from "./types";

export class SealError extends Error {
  readonly code: SealErrorCode;

  constructor(code: SealErrorCode, message?: string) {
    super(message ?? code);
    this.name = "SealError";
    this.code = code;
  }
}

export function fail(code: SealErrorCode) {
  return {
    ok: false as const,
    code
  };
}