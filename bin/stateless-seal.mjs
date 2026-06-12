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

  return {
    token: prefix,
    version,
    algorithm: header.alg,
    keyId: header.kid,
    purpose: header.pur,
    issuer: header.iss,
    ...(header.aud !== undefined ? { audience: header.aud } : {}),
    verified: false,
    segments: {
      headerChars: headerB64.length,
      ivChars: ivB64.length,
      ciphertextChars: ciphertextB64.length
    }
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
  stateless-seal version

Commands:
  keygen    Generate a 32-byte base64url AES-GCM key.
  inspect   Decode public token metadata without verifying or decrypting.
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

function decodeBase64Char(char) {
  const index = BASE64_ALPHABET.indexOf(char);

  if (index === -1) {
    throw new Error("Invalid base64 character.");
  }

  return index;
}
