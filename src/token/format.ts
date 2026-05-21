import type { ParsedToken, TokenHeader } from "../core/types";
import {
  base64urlDecode,
  base64urlDecodeJson,
  base64urlEncode,
  base64urlEncodeJson
} from "./base64url";

export const TOKEN_PREFIX = "stseal";
export const TOKEN_VERSION = "v1";

export function encodeToken(parts: {
  header: TokenHeader;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}): string {
  const headerB64 = base64urlEncodeJson(parts.header);
  const ivB64 = base64urlEncode(parts.iv);
  const ciphertextB64 = base64urlEncode(parts.ciphertext);

  return [TOKEN_PREFIX, TOKEN_VERSION, headerB64, ivB64, ciphertextB64].join(
    "."
  );
}

export function parseToken(token: string): ParsedToken | null {
  const parts = token.split(".");

  if (parts.length !== 5) {
    return null;
  }

  const [prefix, version, headerB64, ivB64, ciphertextB64] = parts;

  if (prefix !== TOKEN_PREFIX) {
    return null;
  }

  if (version !== TOKEN_VERSION) {
    return null;
  }

  if (!headerB64 || !ivB64 || !ciphertextB64) {
    return null;
  }

  try {
    const header = base64urlDecodeJson<TokenHeader>(headerB64);
    const iv = base64urlDecode(ivB64);
    const ciphertext = base64urlDecode(ciphertextB64);

    if (iv.byteLength !== 12) {
      return null;
    }

    if (!isValidHeader(header)) {
      return null;
    }

    return {
      prefix,
      version,
      header,
      headerB64,
      iv,
      ciphertext
    };
  } catch {
    return null;
  }
}

export function createAad(headerB64: string): Uint8Array {
  return new TextEncoder().encode(`${TOKEN_PREFIX}.${TOKEN_VERSION}.${headerB64}`);
}

function isValidHeader(header: unknown): header is TokenHeader {
  if (!header || typeof header !== "object") {
    return false;
  }

  const value = header as Record<string, unknown>;

  return (
    value.alg === "A256GCM" &&
    typeof value.kid === "string" &&
    typeof value.pur === "string" &&
    typeof value.iss === "string" &&
    (value.aud === undefined || typeof value.aud === "string")
  );
}