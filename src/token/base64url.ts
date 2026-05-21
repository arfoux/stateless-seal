function getTextEncoder() {
  return new TextEncoder();
}

function getTextDecoder() {
  return new TextDecoder();
}

export function base64urlEncode(input: Uint8Array): string {
  let binary = "";

  for (const byte of input) {
    binary += String.fromCharCode(byte);
  }

  const base64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(input).toString("base64");

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64urlDecode(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );

  const binary =
    typeof atob === "function"
      ? atob(padded)
      : Buffer.from(padded, "base64").toString("binary");

  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

export function base64urlEncodeJson(value: unknown): string {
  const json = JSON.stringify(value);
  return base64urlEncode(getTextEncoder().encode(json));
}

export function base64urlDecodeJson<T>(input: string): T {
  const bytes = base64urlDecode(input);
  const json = getTextDecoder().decode(bytes);
  return JSON.parse(json) as T;
}