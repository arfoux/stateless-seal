import type { ReplayStore, ReplayStoreConsumeResult } from "../core/types";

export type UpstashRedisReplayStoreOptions = {
  url: string;
  token: string;
  prefix?: string;
  clock?: () => number;
  minimumTtlSeconds?: number;
  fetch?: typeof fetch;
};

type UpstashRedisResponse =
  | {
      result?: unknown;
      error?: unknown;
    }
  | unknown;

const DEFAULT_PREFIX = "stateless-seal:replay:";
const DEFAULT_MINIMUM_TTL_SECONDS = 1;

export function upstashRedisReplayStore(
  options: UpstashRedisReplayStoreOptions
): ReplayStore {
  const url = normalizeUrl(options.url);
  const token = normalizeToken(options.token);
  const prefix = normalizePrefix(options.prefix);
  const clock = options.clock ?? (() => Date.now());
  const minimumTtlSeconds = normalizeMinimumTtlSeconds(
    options.minimumTtlSeconds
  );
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (typeof fetchImpl !== "function") {
    throw new TypeError("Upstash Redis replay store requires fetch.");
  }

  return {
    async consume(
      id: string,
      expiresAt: number
    ): Promise<ReplayStoreConsumeResult> {
      const key = `${prefix}${id}`;
      const ttl = calculateExpirationTtl({
        now: clock(),
        expiresAt,
        minimumTtlSeconds
      });
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          accept: "application/json"
        },
        body: JSON.stringify(["SET", key, "1", "EX", ttl, "NX"])
      });

      if (!response.ok) {
        throw new Error("Upstash Redis replay store request failed.");
      }

      const json = (await response.json()) as UpstashRedisResponse;

      if (!json || typeof json !== "object") {
        throw new Error("Upstash Redis replay store returned invalid JSON.");
      }

      const result = json as { result?: unknown; error?: unknown };

      if (typeof result.error === "string") {
        throw new Error(result.error);
      }

      if (result.result === "OK") {
        return "ok";
      }

      if (result.result === null) {
        return "replayed";
      }

      throw new Error("Upstash Redis replay store returned an invalid result.");
    }
  };
}

function calculateExpirationTtl(params: {
  now: number;
  expiresAt: number;
  minimumTtlSeconds: number;
}): number {
  if (!Number.isFinite(params.expiresAt) || !Number.isFinite(params.now)) {
    return params.minimumTtlSeconds;
  }

  const secondsUntilExpiry = Math.ceil((params.expiresAt - params.now) / 1000);
  return Math.max(params.minimumTtlSeconds, secondsUntilExpiry);
}

function normalizeUrl(url: string): string {
  if (typeof url !== "string" || url.length === 0) {
    throw new TypeError("Upstash Redis replay url is required.");
  }

  return url.replace(/\/+$/, "");
}

function normalizeToken(token: string): string {
  if (typeof token !== "string" || token.length === 0) {
    throw new TypeError("Upstash Redis replay token is required.");
  }

  return token;
}

function normalizePrefix(prefix: string | undefined): string {
  if (prefix === undefined) {
    return DEFAULT_PREFIX;
  }

  if (typeof prefix !== "string") {
    throw new TypeError("Upstash Redis replay prefix must be a string.");
  }

  return prefix;
}

function normalizeMinimumTtlSeconds(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_MINIMUM_TTL_SECONDS;
  }

  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(
      "Upstash Redis replay minimumTtlSeconds must be positive."
    );
  }

  return Math.max(1, Math.ceil(value));
}
