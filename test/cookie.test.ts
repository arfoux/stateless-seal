import { describe, expect, it } from "vitest";
import {
  clearCookie,
  getCookie,
  parseCookies,
  serializeCookie
} from "../src";
import { logTestStep } from "./debug-log";

describe("cookie helpers", () => {
  it("serializes an edge-safe Set-Cookie header", () => {
    const header = serializeCookie("session", "stseal.v1.header.iv.ct", {
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      path: "/",
      maxAge: 3600
    });

    logTestStep("cookie.serialize", header);

    expect(header).toBe(
      "session=stseal.v1.header.iv.ct; Max-Age=3600; Path=/; HttpOnly; Secure; SameSite=Strict"
    );
  });

  it("parses Cookie headers and decodes values", () => {
    const cookies = parseCookies("session=abc.def; theme=light; name=Fatih%20Farros");

    logTestStep("cookie.parse", cookies);

    expect(cookies.session).toBe("abc.def");
    expect(cookies.theme).toBe("light");
    expect(cookies.name).toBe("Fatih Farros");
  });

  it("reads a single cookie by name", () => {
    const session = getCookie("session=token; theme=light", "session");
    const missing = getCookie("session=token; theme=light", "missing");

    logTestStep("cookie.get", {
      session,
      missing
    });

    expect(session).toBe("token");
    expect(missing).toBeNull();
  });

  it("serializes a clearing cookie", () => {
    const header = clearCookie("session", {
      path: "/",
      secure: true,
      sameSite: "Lax"
    });

    logTestStep("cookie.clear", header);

    expect(header).toContain("session=");
    expect(header).toContain("Max-Age=0");
    expect(header).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    expect(header).toContain("Path=/");
    expect(header).toContain("Secure");
    expect(header).toContain("SameSite=Lax");
  });

  it("rejects invalid cookie names and attributes", () => {
    logTestStep("cookie.invalid-inputs", {
      invalidName: "bad name",
      invalidPath: "/;\\nInjected=1"
    });

    expect(() => serializeCookie("bad name", "value")).toThrow(TypeError);
    expect(() =>
      serializeCookie("session", "value", {
        path: "/;\nInjected=1"
      })
    ).toThrow(TypeError);
  });
});
