import { describe, expect, it } from "vitest";
import { createSealer, generateSealKey } from "../src";
import { createCookieSession } from "../src/cookie-session";
import { logTestStep, summarizeResult } from "./debug-log";

type SessionPayload = {
  userId: string;
};

function createSessionToken(clock?: () => number) {
  const key = generateSealKey();
  const sealer = createSealer({
    issuer: "my-app",
    keys: {
      "2026-05": key
    },
    currentKeyId: "2026-05",
    ...(clock ? { clock } : {})
  });

  return sealer.defineToken<SessionPayload>({
    purpose: "session",
    ttl: "10m",
    audience: "web"
  });
}

function toCookieHeader(setCookie: string): string {
  return setCookie.split(";")[0]!;
}

function cookieAttributes(setCookie: string): string[] {
  return setCookie.split("; ").slice(1);
}

describe("cookie session", () => {
  it("commits and reads a sealed session cookie", async () => {
    const token = createSessionToken();
    const session = createCookieSession({
      token,
      cookieName: "__Host-session"
    });

    const setCookie = await session.commit({
      userId: "user_123"
    });
    const attributes = cookieAttributes(setCookie);
    const result = await session.read(toCookieHeader(setCookie));

    logTestStep("cookie-session.commit-read", {
      setCookie,
      result: summarizeResult(result)
    });

    expect(setCookie).toContain("__Host-session=");
    expect(attributes).toContain("Path=/");
    expect(attributes).toContain("HttpOnly");
    expect(attributes).toContain("Secure");
    expect(attributes).toContain("SameSite=Lax");
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.payload.userId).toBe("user_123");
      expect(result.meta.purpose).toBe("session");
    }
  });

  it("reads from headers-like and request-like sources", async () => {
    const token = createSessionToken();
    const session = createCookieSession({
      token,
      cookieName: "session"
    });
    const setCookie = await session.commit({
      userId: "user_123"
    });
    const cookieHeader = toCookieHeader(setCookie);
    const headersLike = {
      get(name: string) {
        return name.toLowerCase() === "cookie" ? cookieHeader : null;
      }
    };
    const requestLike = {
      headers: headersLike
    };

    const fromHeaders = await session.read(headersLike);
    const fromRequest = await session.read(requestLike);

    logTestStep("cookie-session.sources", {
      fromHeaders: summarizeResult(fromHeaders),
      fromRequest: summarizeResult(fromRequest)
    });

    expect(fromHeaders.ok).toBe(true);
    expect(fromRequest.ok).toBe(true);
  });

  it("returns missing_cookie for absent cookies", async () => {
    const token = createSessionToken();
    const session = createCookieSession({
      token,
      cookieName: "session"
    });

    const result = await session.read("theme=light");
    const payload = await session.readOrNull("theme=light");

    logTestStep("cookie-session.missing-cookie", {
      result,
      payload
    });

    expect(result.ok).toBe(false);
    expect(payload).toBeNull();

    if (!result.ok) {
      expect(result.code).toBe("missing_cookie");
    }
  });

  it("returns token errors for invalid cookie values", async () => {
    const token = createSessionToken();
    const session = createCookieSession({
      token,
      cookieName: "session"
    });

    const result = await session.read("session=not-a-token");
    const payload = await session.readOrNull("session=not-a-token");

    logTestStep("cookie-session.invalid-token", {
      result,
      payload
    });

    expect(result.ok).toBe(false);
    expect(payload).toBeNull();

    if (!result.ok) {
      expect(result.code).toBe("malformed_token");
    }
  });

  it("allows cookie and seal option overrides", async () => {
    let now = 1000;
    const token = createSessionToken(() => now);
    const session = createCookieSession({
      token,
      cookieName: "session",
      cookie: {
        secure: false,
        sameSite: "Strict",
        maxAge: 600
      }
    });

    const setCookie = await session.commit(
      {
        userId: "user_123"
      },
      {
        seal: {
          notBefore: "5s"
        },
        cookie: {
          path: "/app",
          maxAge: 300
        }
      }
    );
    const attributes = cookieAttributes(setCookie);
    const early = await session.read(toCookieHeader(setCookie));

    now = 6000;

    const valid = await session.read(toCookieHeader(setCookie));

    logTestStep("cookie-session.overrides", {
      setCookie,
      early: summarizeResult(early),
      valid: summarizeResult(valid)
    });

    expect(attributes).toContain("Max-Age=300");
    expect(attributes).toContain("Path=/app");
    expect(attributes).toContain("HttpOnly");
    expect(attributes).not.toContain("Secure");
    expect(attributes).toContain("SameSite=Strict");
    expect(early.ok).toBe(false);
    expect(valid.ok).toBe(true);

    if (!early.ok) {
      expect(early.code).toBe("not_yet_valid");
    }
  });

  it("clears a session cookie with safe defaults", () => {
    const token = createSessionToken();
    const session = createCookieSession({
      token,
      cookieName: "__Host-session"
    });

    const setCookie = session.clear();
    const attributes = cookieAttributes(setCookie);

    logTestStep("cookie-session.clear", setCookie);

    expect(setCookie).toContain("__Host-session=");
    expect(attributes).toContain("Max-Age=0");
    expect(attributes).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    expect(attributes).toContain("Path=/");
    expect(attributes).toContain("HttpOnly");
    expect(attributes).toContain("Secure");
    expect(attributes).toContain("SameSite=Lax");
  });
});
