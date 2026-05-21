const BASE64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function base64urlEncode(input: Uint8Array): string {
  let output = "";

  for (let i = 0; i < input.length; i += 3) {
    const byte1 = input[i]!;
    const byte2 = input[i + 1];
    const byte3 = input[i + 2];

    const hasByte2 = byte2 !== undefined;
    const hasByte3 = byte3 !== undefined;

    const triplet =
      (byte1 << 16) |
      ((hasByte2 ? byte2 : 0) << 8) |
      (hasByte3 ? byte3 : 0);

    output += BASE64URL_ALPHABET[(triplet >> 18) & 63];
    output += BASE64URL_ALPHABET[(triplet >> 12) & 63];

    if (hasByte2) {
      output += BASE64URL_ALPHABET[(triplet >> 6) & 63];
    }

    if (hasByte3) {
      output += BASE64URL_ALPHABET[triplet & 63];
    }
  }

  return output;
}

export function base64urlDecode(input: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(input)) {
    throw new Error("Invalid base64url input.");
  }

  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "="
  );

  const bytes: number[] = [];

  for (let i = 0; i < padded.length; i += 4) {
    const char1 = padded[i]!;
    const char2 = padded[i + 1]!;
    const char3 = padded[i + 2]!;
    const char4 = padded[i + 3]!;

    const enc1 = decodeBase64Char(char1);
    const enc2 = decodeBase64Char(char2);
    const enc3 = char3 === "=" ? 0 : decodeBase64Char(char3);
    const enc4 = char4 === "=" ? 0 : decodeBase64Char(char4);

    const triplet = (enc1 << 18) | (enc2 << 12) | (enc3 << 6) | enc4;

    bytes.push((triplet >> 16) & 255);

    if (char3 !== "=") {
      bytes.push((triplet >> 8) & 255);
    }

    if (char4 !== "=") {
      bytes.push(triplet & 255);
    }
  }

  return new Uint8Array(bytes);
}

export function base64urlEncodeJson(value: unknown): string {
  const json = JSON.stringify(value);
  return base64urlEncode(new TextEncoder().encode(json));
}

export function base64urlDecodeJson<T>(input: string): T {
  const bytes = base64urlDecode(input);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as T;
}

function decodeBase64Char(char: string): number {
  const index = BASE64_ALPHABET.indexOf(char);

  if (index === -1) {
    throw new Error("Invalid base64 character.");
  }

  return index;
}