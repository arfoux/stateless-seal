import { base64urlDecode, base64urlEncode } from "../token/base64url";
import type { SealKeyInput } from "../core/types";

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function importAesGcmKey(input: SealKeyInput): Promise<CryptoKey> {
  if (isCryptoKey(input)) {
    return input;
  }

  let raw: Uint8Array;

  if (typeof input === "string") {
    raw = base64urlDecode(input);
  } else {
    raw = input;
  }

  if (raw.byteLength !== 32) {
    throw new Error(
      "Invalid key length. stateless-seal v0.1 requires a 32-byte base64url key."
    );
  }

  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(raw),
    {
      name: "AES-GCM"
    },
    false,
    ["encrypt", "decrypt"]
  );
}

function isCryptoKey(value: unknown): value is CryptoKey {
  return typeof CryptoKey !== "undefined" && value instanceof CryptoKey;
}

export function generateSealKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}