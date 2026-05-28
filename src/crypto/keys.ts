import { base64urlDecode, base64urlEncode } from "../token/base64url";
import type { SealKeyInput } from "../core/types";
import { SealError } from "../core/errors";

type KeyUsageMode = "seal" | "unseal";

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function importAesGcmKey(
  input: SealKeyInput,
  usage: KeyUsageMode
): Promise<CryptoKey> {
  if (isCryptoKey(input)) {
    validateCryptoKey(input, usage);
    return input;
  }

  let raw: Uint8Array;

  try {
    if (typeof input === "string") {
      raw = base64urlDecode(input);
    } else {
      raw = input;
    }
  } catch {
    throw new SealError("invalid_key", "Key must be valid base64url.");
  }

  if (raw.byteLength !== 32) {
    throw new SealError(
      "invalid_key",
      "Key must be exactly 32 bytes for AES-256-GCM."
    );
  }

  try {
    return await crypto.subtle.importKey(
      "raw",
      toArrayBuffer(raw),
      {
        name: "AES-GCM"
      },
      false,
      usage === "seal" ? ["encrypt"] : ["decrypt"]
    );
  } catch {
    throw new SealError("invalid_key", "Key could not be imported.");
  }
}

function isCryptoKey(value: unknown): value is CryptoKey {
  return typeof CryptoKey !== "undefined" && value instanceof CryptoKey;
}

function validateCryptoKey(key: CryptoKey, usage: KeyUsageMode) {
  if (key.type !== "secret") {
    throw new SealError("invalid_key", "CryptoKey must be a secret key.");
  }

  if (!("name" in key.algorithm) || key.algorithm.name !== "AES-GCM") {
    throw new SealError("invalid_key", "CryptoKey algorithm must be AES-GCM.");
  }

  const requiredUsage = usage === "seal" ? "encrypt" : "decrypt";

  if (!key.usages.includes(requiredUsage)) {
    throw new SealError(
      "invalid_key",
      `CryptoKey must allow ${requiredUsage}.`
    );
  }
}

export function generateSealKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}
