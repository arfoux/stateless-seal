import { describe, expect, it } from "vitest";
import { createSealer, generateSealKey } from "../src";
import { upstashRedisReplayStore } from "../src/upstash";
import { logTestStep, summarizeResult, summarizeToken } from "./debug-log";

type CapturedRequest = {
  input: string;
  method?: string;
  headers?: HeadersInit;
  body?: unknown;
};

function createFetchStub(
  results: Array<{ status?: number; body: unknown }>
): {
  fetch: typeof fetch;
  requests: CapturedRequest[];
} {
  const requests: CapturedRequest[] = [];

  const fetchStub: typeof fetch = async (input, init) => {
    const request: CapturedRequest = {
      input: String(input),
      body:
        typeof init?.body === "string" ? JSON.parse(init.body) : init?.body
    };

    if (init?.method !== undefined) {
      request.method = init.method;
    }

    if (init?.headers !== undefined) {
      request.headers = init.headers;
    }

    requests.push(request);

    const next = results.shift();

    if (!next) {
      throw new Error("Unexpected fetch call.");
    }

    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: {
        "content-type": "application/json"
      }
    });
  };

  return {
    fetch: fetchStub,
    requests
  };
}

describe("upstashRedisReplayStore", () => {
  it("consumes a token id once with SET NX EX and marks replays", async () => {
    const { fetch, requests } = createFetchStub([
      {
        body: {
          result: "OK"
        }
      },
      {
        body: {
          result: null
        }
      }
    ]);
    const store = upstashRedisReplayStore({
      url: "https://example.upstash.io/",
      token: "secret",
      prefix: "test:",
      clock: () => 1000,
      fetch
    });

    await expect(store.consume("jti_123", 11_000)).resolves.toBe("ok");
    await expect(store.consume("jti_123", 11_000)).resolves.toBe("replayed");

    logTestStep("upstash-redis.consume-once", {
      requests
    });

    expect(requests).toEqual([
      {
        input: "https://example.upstash.io",
        method: "POST",
        headers: {
          authorization: "Bearer secret",
          "content-type": "application/json",
          accept: "application/json"
        },
        body: ["SET", "test:jti_123", "1", "EX", 10, "NX"]
      },
      {
        input: "https://example.upstash.io",
        method: "POST",
        headers: {
          authorization: "Bearer secret",
          "content-type": "application/json",
          accept: "application/json"
        },
        body: ["SET", "test:jti_123", "1", "EX", 10, "NX"]
      }
    ]);
  });

  it("uses the configured minimum ttl when token expiry is closer", async () => {
    const { fetch, requests } = createFetchStub([
      {
        body: {
          result: "OK"
        }
      }
    ]);
    const store = upstashRedisReplayStore({
      url: "https://example.upstash.io",
      token: "secret",
      clock: () => 1000,
      minimumTtlSeconds: 60,
      fetch
    });

    await expect(store.consume("jti_123", 2_000)).resolves.toBe("ok");

    logTestStep("upstash-redis.minimum-ttl", {
      request: requests[0]
    });

    expect(requests[0]?.body).toEqual([
      "SET",
      "stateless-seal:replay:jti_123",
      "1",
      "EX",
      60,
      "NX"
    ]);
  });

  it("throws when Upstash returns an HTTP or Redis error", async () => {
    const httpFailure = upstashRedisReplayStore({
      url: "https://example.upstash.io",
      token: "secret",
      fetch: createFetchStub([
        {
          status: 500,
          body: {
            error: "server unavailable"
          }
        }
      ]).fetch
    });
    const redisFailure = upstashRedisReplayStore({
      url: "https://example.upstash.io",
      token: "secret",
      fetch: createFetchStub([
        {
          body: {
            error: "ERR invalid command"
          }
        }
      ]).fetch
    });

    await expect(httpFailure.consume("jti_123", 11_000)).rejects.toThrow(
      "request failed"
    );
    await expect(redisFailure.consume("jti_123", 11_000)).rejects.toThrow(
      "ERR invalid command"
    );
  });

  it("works with unsealOnce", async () => {
    const key = generateSealKey();
    const { fetch } = createFetchStub([
      {
        body: {
          result: "OK"
        }
      },
      {
        body: {
          result: null
        }
      }
    ]);
    const sealer = createSealer({
      issuer: "upstash-demo",
      keys: {
        "2026-06": key
      },
      currentKeyId: "2026-06",
      clock: () => 1000
    });
    const MagicLinkToken = sealer.defineToken<{ userId: string }>({
      purpose: "magic-link",
      ttl: "10m",
      audience: "web",
      oneTime: true
    });
    const store = upstashRedisReplayStore({
      url: "https://example.upstash.io",
      token: "secret",
      clock: () => 1000,
      fetch
    });
    const token = await MagicLinkToken.seal({
      userId: "user_123"
    });
    const first = await MagicLinkToken.unsealOnce(token, { store });
    const second = await MagicLinkToken.unsealOnce(token, { store });

    logTestStep("upstash-redis.unseal-once", {
      token: summarizeToken(token),
      first: summarizeResult(first),
      second: summarizeResult(second)
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);

    if (!second.ok) {
      expect(second.code).toBe("replayed");
    }
  });

  it("propagates Upstash failures through replay_store_failed", async () => {
    const key = generateSealKey();
    const sealer = createSealer({
      issuer: "upstash-demo",
      keys: {
        "2026-06": key
      },
      currentKeyId: "2026-06"
    });
    const MagicLinkToken = sealer.defineToken<{ userId: string }>({
      purpose: "magic-link",
      ttl: "10m",
      oneTime: true
    });
    const token = await MagicLinkToken.seal({
      userId: "user_123"
    });
    const result = await MagicLinkToken.unsealOnce(token, {
      store: upstashRedisReplayStore({
        url: "https://example.upstash.io",
        token: "secret",
        fetch: createFetchStub([
          {
            status: 500,
            body: {
              error: "server unavailable"
            }
          }
        ]).fetch
      })
    });

    logTestStep("upstash-redis.failure", {
      result: summarizeResult(result)
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.code).toBe("replay_store_failed");
    }
  });
});
