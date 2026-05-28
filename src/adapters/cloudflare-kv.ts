import type { ReplayStore, ReplayStoreConsumeResult } from "../core/types";

export type CloudflareKVNamespace = {
  get(key: string, type: "text"): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: {
      expirationTtl?: number;
    }
  ): Promise<void>;
};

export type CloudflareKVReplayStoreOptions = {
  prefix?: string;
  clock?: () => number;
  minimumTtlSeconds?: number;
};

const DEFAULT_PREFIX = "stateless-seal:replay:";
const DEFAULT_MINIMUM_TTL_SECONDS = 60;

export function cloudflareKVReplayStore(
  namespace: CloudflareKVNamespace,
  options: CloudflareKVReplayStoreOptions = {}
): ReplayStore {
  const prefix = normalizePrefix(options.prefix);
  const clock = options.clock ?? (() => Date.now());
  const minimumTtlSeconds = normalizeMinimumTtlSeconds(
    options.minimumTtlSeconds
  );

  return {
    async consume(
      id: string,
      expiresAt: number
    ): Promise<ReplayStoreConsumeResult> {
      const key = `${prefix}${id}`;
      const existing = await namespace.get(key, "text");

      if (existing !== null) {
        return "replayed";
      }

      await namespace.put(key, "1", {
        expirationTtl: calculateExpirationTtl({
          now: clock(),
          expiresAt,
          minimumTtlSeconds
        })
      });

      return "ok";
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
  const ttl = Math.max(params.minimumTtlSeconds, secondsUntilExpiry);

  return Math.max(1, ttl);
}

function normalizePrefix(prefix: string | undefined): string {
  if (prefix === undefined) {
    return DEFAULT_PREFIX;
  }

  if (typeof prefix !== "string") {
    throw new TypeError("Cloudflare KV replay prefix must be a string.");
  }

  return prefix;
}

function normalizeMinimumTtlSeconds(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_MINIMUM_TTL_SECONDS;
  }

  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(
      "Cloudflare KV replay minimumTtlSeconds must be positive."
    );
  }

  return Math.max(DEFAULT_MINIMUM_TTL_SECONDS, Math.ceil(value));
}
