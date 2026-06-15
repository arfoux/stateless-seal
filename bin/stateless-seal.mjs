#!/usr/bin/env node

import { readFileSync } from "node:fs";

const BASE64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const args = process.argv.slice(2);
const command = args[0];

try {
  switch (command) {
    case "keygen":
      await runKeygen();
      break;
    case "inspect":
      runInspect(args.slice(1));
      break;
    case "seal":
      await runSeal(args.slice(1));
      break;
    case "unseal":
      await runUnseal(args.slice(1));
      break;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      printHelp();
      break;
    case "version":
    case "--version":
    case "-v":
      printVersion();
      break;
    default:
      fail(`Unknown command: ${command}`);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : "Command failed.");
}

async function runKeygen() {
  const crypto = await getCrypto();
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  console.log(base64urlEncode(bytes));
}

async function runSeal(sealArgs) {
  const { options } = parseArgs(sealArgs);
  const keyInput = requiredOption(options, "key", sealUsage());
  const keyId = requiredOption(options, "kid", sealUsage());
  const issuer = requiredOption(options, "issuer", sealUsage());
  const purpose = requiredOption(options, "purpose", sealUsage());
  const ttl = requiredOption(options, "ttl", sealUsage());
  const payloadInput = optionalOption(options, "payload");
  const payloadFile = optionalOption(options, "payload-file");
  const audience = optionalOption(options, "audience");
  const now = Date.now();

  if (
    (payloadInput === undefined && payloadFile === undefined) ||
    (payloadInput !== undefined && payloadFile !== undefined)
  ) {
    throw new Error(sealUsage());
  }

  const payload = parseJson(
    payloadInput ?? readFileSync(payloadFile, "utf8"),
    payloadInput === undefined ? "payload-file" : "payload"
  );
  const ttlMs = parseDuration(ttl, "ttl");
  const key = await importAesGcmKey(keyInput, ["encrypt"]);
  const crypto = await getCrypto();
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  const header = {
    alg: "A256GCM",
    kid: keyId,
    pur: purpose,
    iss: issuer,
    ...(audience !== undefined ? { aud: audience } : {})
  };
  const body = {
    iat: now,
    exp: now + ttlMs,
    data: payload
  };

  const headerB64 = base64urlEncodeJson(header);
  const aad = createAad(headerB64);
  const plaintext = new TextEncoder().encode(JSON.stringify(body));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: aad,
        tagLength: 128
      },
      key,
      plaintext
    )
  );

  console.log(
    ["stseal", "v1", headerB64, base64urlEncode(iv), base64urlEncode(ciphertext)].join(
      "."
    )
  );
}

async function runUnseal(unsealArgs) {
  const { options, positional } = parseArgs(unsealArgs);
  const token = positional[0] ?? optionalOption(options, "token");
  const keyInput = requiredOption(options, "key", unsealUsage());
  const issuer = requiredOption(options, "issuer", unsealUsage());
  const purpose = requiredOption(options, "purpose", unsealUsage());
  const expectedAudience = optionalOption(options, "audience");
  const expectedKeyId = optionalOption(options, "kid");
  const json = options.json === true;

  if (!token) {
    throw new Error(unsealUsage());
  }

  const parsed = parseTokenForCrypto(token);

  if (parsed.header.pur !== purpose) {
    throw new Error("Token rejected: purpose_mismatch");
  }

  if (parsed.header.iss !== issuer) {
    throw new Error("Token rejected: issuer_mismatch");
  }

  if (expectedAudience !== undefined && parsed.header.aud !== expectedAudience) {
    throw new Error("Token rejected: audience_mismatch");
  }

  if (expectedKeyId !== undefined && parsed.header.kid !== expectedKeyId) {
    throw new Error("Token rejected: unknown_kid");
  }

  const key = await importAesGcmKey(keyInput, ["decrypt"]);
  const crypto = await getCrypto();
  let body;

  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: parsed.iv,
        additionalData: createAad(parsed.headerB64),
        tagLength: 128
      },
      key,
      parsed.ciphertext
    );

    body = JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new Error("Token rejected: decrypt_failed");
  }

  const now = Date.now();

  if (!body || typeof body !== "object") {
    throw new Error("Token rejected: decrypt_failed");
  }

  if (typeof body.exp !== "number" || now > body.exp) {
    throw new Error("Token rejected: expired");
  }

  if (body.nbf !== undefined && (typeof body.nbf !== "number" || now < body.nbf)) {
    throw new Error("Token rejected: not_yet_valid");
  }

  const meta = {
    version: "v1",
    algorithm: parsed.header.alg,
    keyId: parsed.header.kid,
    purpose: parsed.header.pur,
    issuer: parsed.header.iss,
    issuedAt: body.iat,
    expiresAt: body.exp,
    ...(body.nbf !== undefined ? { notBefore: body.nbf } : {}),
    ...(typeof body.jti === "string" ? { tokenId: body.jti } : {}),
    ...(parsed.header.aud !== undefined ? { audience: parsed.header.aud } : {})
  };

  if (json) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          payload: body.data,
          meta
        },
        null,
        2
      )
    );
    return;
  }

  console.log(JSON.stringify(body.data, null, 2));
}

function runInspect(inspectArgs) {
  const json = inspectArgs.includes("--json");
  const token = inspectArgs.find((arg) => arg !== "--json");

  if (!token) {
    throw new Error("Usage: stateless-seal inspect <token> [--json]");
  }

  const meta = inspectTokenUnverified(token);

  if (json) {
    console.log(JSON.stringify(meta, null, 2));
    return;
  }

  console.log(`Token: ${meta.token}`);
  console.log(`Version: ${meta.version}`);
  console.log(`Algorithm: ${meta.algorithm}`);
  console.log(`Key ID: ${meta.keyId}`);
  console.log(`Purpose: ${meta.purpose}`);
  console.log(`Issuer: ${meta.issuer}`);
  console.log(`Audience: ${meta.audience ?? "(none)"}`);
  console.log("Verified: no");
}

function inspectTokenUnverified(token) {
  const parsed = parseTokenForCrypto(token);

  return {
    token: parsed.prefix,
    version: parsed.version,
    algorithm: parsed.header.alg,
    keyId: parsed.header.kid,
    purpose: parsed.header.pur,
    issuer: parsed.header.iss,
    ...(parsed.header.aud !== undefined ? { audience: parsed.header.aud } : {}),
    verified: false,
    segments: {
      headerChars: parsed.headerB64.length,
      ivChars: parsed.ivB64.length,
      ciphertextChars: parsed.ciphertextB64.length
    }
  };
}

function parseTokenForCrypto(token) {
  const parts = token.split(".");

  if (parts.length !== 5) {
    throw new Error("Malformed Stateless Seal token.");
  }

  const [prefix, version, headerB64, ivB64, ciphertextB64] = parts;

  if (prefix !== "stseal") {
    throw new Error("Unsupported token prefix.");
  }

  if (version !== "v1") {
    throw new Error("Unsupported token version.");
  }

  const header = base64urlDecodeJson(headerB64);

  if (!isHeader(header)) {
    throw new Error("Malformed token header.");
  }

  const iv = base64urlDecode(ivB64);

  if (iv.byteLength !== 12) {
    throw new Error("Malformed token IV.");
  }

  return {
    prefix,
    version,
    header,
    headerB64,
    ivB64,
    ciphertextB64,
    iv,
    ciphertext: base64urlDecode(ciphertextB64)
  };
}

function isHeader(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (
    value.alg === "A256GCM" &&
    typeof value.kid === "string" &&
    typeof value.pur === "string" &&
    typeof value.iss === "string" &&
    (value.aud === undefined || typeof value.aud === "string")
  );
}

function printHelp() {
  console.log(`stateless-seal

Usage:
  stateless-seal keygen
  stateless-seal inspect <token> [--json]
  stateless-seal seal --key <key> --kid <kid> --issuer <issuer> --purpose <purpose> --ttl <ttl> (--payload <json> | --payload-file <path>) [--audience <audience>]
  stateless-seal unseal <token> --key <key> --issuer <issuer> --purpose <purpose> [--audience <audience>] [--kid <kid>] [--json]
  stateless-seal version

Commands:
  keygen    Generate a 32-byte base64url AES-GCM key.
  inspect   Decode public token metadata without verifying or decrypting.
  seal      Seal a JSON payload for debugging and local workflows.
  unseal    Verify and decrypt a token for debugging and local workflows.
  version   Print the installed package version.
`);
}

function printVersion() {
  console.log(readPackageVersion());
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function readPackageVersion() {
  const packageJsonUrl = new URL("../package.json", import.meta.url);
  const packageJson = JSON.parse(readFileSync(packageJsonUrl, "utf8"));

  if (typeof packageJson.version !== "string") {
    throw new Error("Package version is unavailable.");
  }

  return packageJson.version;
}

async function getCrypto() {
  if (globalThis.crypto?.getRandomValues) {
    return globalThis.crypto;
  }

  const { webcrypto } = await import("node:crypto");
  return webcrypto;
}

async function importAesGcmKey(input, usages) {
  const raw = base64urlDecode(input);

  if (raw.byteLength !== 32) {
    throw new Error("Key must be exactly 32 bytes for AES-256-GCM.");
  }

  const crypto = await getCrypto();

  try {
    return await crypto.subtle.importKey(
      "raw",
      toArrayBuffer(raw),
      {
        name: "AES-GCM"
      },
      false,
      usages
    );
  } catch {
    throw new Error("Key could not be imported.");
  }
}

function createAad(headerB64) {
  return new TextEncoder().encode(`stseal.v1.${headerB64}`);
}

function parseArgs(rawArgs) {
  const options = {};
  const positional = [];

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const name = arg.slice(2);

    if (name === "json") {
      options[name] = true;
      continue;
    }

    const value = rawArgs[index + 1];

    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for --${name}.`);
    }

    options[name] = value;
    index += 1;
  }

  return {
    options,
    positional
  };
}

function requiredOption(options, name, usage) {
  const value = optionalOption(options, name);

  if (value === undefined) {
    throw new Error(usage);
  }

  return value;
}

function optionalOption(options, name) {
  const value = options[name];

  if (value === undefined || value === true) {
    return undefined;
  }

  return value;
}

function parseJson(input, name) {
  try {
    return JSON.parse(input);
  } catch {
    throw new Error(`${name} must be valid JSON.`);
  }
}

function parseDuration(input, name) {
  if (/^\d+$/.test(input)) {
    const value = Number(input);

    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`${name} must be a positive safe integer.`);
    }

    return value;
  }

  const match = /^(\d+)(ms|s|m|h|d)$/.exec(input);

  if (!match) {
    throw new Error(`${name} must be a duration like 15m, 1h, or 60000.`);
  }

  const value = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case "ms":
      return value;
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`${name} uses an unsupported duration unit.`);
  }
}

function sealUsage() {
  return "Usage: stateless-seal seal --key <key> --kid <kid> --issuer <issuer> --purpose <purpose> --ttl <ttl> (--payload <json> | --payload-file <path>) [--audience <audience>]";
}

function unsealUsage() {
  return "Usage: stateless-seal unseal <token> --key <key> --issuer <issuer> --purpose <purpose> [--audience <audience>] [--kid <kid>] [--json]";
}

function base64urlEncodeJson(value) {
  return base64urlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

function base64urlEncode(input) {
  let output = "";

  for (let i = 0; i < input.length; i += 3) {
    const byte1 = input[i];
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

function base64urlDecode(input) {
  if (!/^[A-Za-z0-9_-]*$/.test(input)) {
    throw new Error("Invalid base64url input.");
  }

  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "="
  );
  const bytes = [];

  for (let i = 0; i < padded.length; i += 4) {
    const char1 = padded[i];
    const char2 = padded[i + 1];
    const char3 = padded[i + 2];
    const char4 = padded[i + 3];

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

function base64urlDecodeJson(input) {
  return JSON.parse(new TextDecoder().decode(base64urlDecode(input)));
}

function toArrayBuffer(bytes) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function decodeBase64Char(char) {
  const index = BASE64_ALPHABET.indexOf(char);

  if (index === -1) {
    throw new Error("Invalid base64 character.");
  }

  return index;
}
