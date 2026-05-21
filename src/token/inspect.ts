import type { TokenMeta } from "../core/types";
import { parseToken } from "./format";

export function inspectToken(token: string): TokenMeta | null {
  const parsed = parseToken(token);

  if (!parsed) {
    return null;
  }

  return {
    version: parsed.version,
    algorithm: parsed.header.alg,
    keyId: parsed.header.kid,
    purpose: parsed.header.pur,
    issuer: parsed.header.iss,
    ...(parsed.header.aud ? { audience: parsed.header.aud } : {})
  };
}