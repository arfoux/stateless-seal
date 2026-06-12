import type { UnsealResult } from "../src";

const LOG_ENV_NAMES = ["STSEAL_TEST_LOGS", "STATELESS_SEAL_TEST_LOGS"];

export function logTestStep(label: string, value?: unknown): void {
  if (!isEnabled()) {
    return;
  }

  if (value === undefined) {
    console.log(`[stateless-seal:test] ${label}`);
    return;
  }

  console.log(
    `[stateless-seal:test] ${label}`,
    JSON.stringify(normalizeForLog(value), null, 2)
  );
}

export function summarizeResult<TPayload>(
  result: UnsealResult<TPayload>
): unknown {
  if (!result.ok) {
    return {
      ok: false,
      code: result.code
    };
  }

  return {
    ok: true,
    payload: result.payload,
    meta: result.meta
  };
}

export function summarizeToken(token: string): unknown {
  const [prefix, version, header, iv, ciphertext] = token.split(".");

  return {
    prefix,
    version,
    length: token.length,
    headerChars: header?.length ?? 0,
    ivChars: iv?.length ?? 0,
    ciphertextChars: ciphertext?.length ?? 0
  };
}

function isEnabled(): boolean {
  return LOG_ENV_NAMES.some((name) => process.env[name] === "1");
}

function normalizeForLog(value: unknown): unknown {
  if (typeof value === "string") {
    return summarizeString(value);
  }

  if (value instanceof Uint8Array) {
    return {
      type: "Uint8Array",
      length: value.byteLength,
      bytes: [...value]
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeForLog(item));
  }

  if (value && typeof value === "object") {
    const normalized: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      normalized[key] = normalizeForLog(item);
    }

    return normalized;
  }

  return value;
}

function summarizeString(value: string): string | Record<string, unknown> {
  if (value.length <= 160) {
    return value;
  }

  return {
    length: value.length,
    prefix: value.slice(0, 72),
    suffix: value.slice(-32)
  };
}
