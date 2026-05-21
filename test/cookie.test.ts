import { describe, expect, it } from "vitest";
import {
  clearCookie,
  getCookie,
  parseCookies,
  serializeCookie
} from "../src";

describe("cookie helpers", () => {
  it("serializes an edge-safe Set-Cookie header", () => {
    const header = serializeCookie("session", "stseal.v1.header.iv.ct", {
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      path: "/",
      maxAge: 3600
    });

    expect(header).toBe(
      "session=stseal.v1.header.iv.ct; Max-Age=3600; Path=/; HttpOnly; Secure; SameSite=Strict"
    );
  });

  it("parses Cookie headers and decodes values", () => {
    const cookies = parseCookies("session=abc.def; theme=light; name=Fatih%20Farros");

    expect(cookies.session).toBe("abc.def");
    expect(cookies.theme).toBe("light");
    expect(cookies.name).toBe("Fatih Farros");
  });

  it("reads a single cookie by name", () => {
    expect(getCookie("session=token; theme=light", "session")).toBe("token");
    expect(getCookie("session=token; theme=light", "missing")).toBeNull();
  });

  it("serializes a clearing cookie", () => {
    const header = clearCookie("session", {
      path: "/",
      secure: true,
      sameSite: "Lax"
    });

    expect(header).toContain("session=");
    expect(header).toContain("Max-Age=0");
    expect(header).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    expect(header).toContain("Path=/");
    expect(header).toContain("Secure");
    expect(header).toContain("SameSite=Lax");
  });

  it("rejects invalid cookie names and attributes", () => {
    expect(() => serializeCookie("bad name", "value")).toThrow(TypeError);
    expect(() =>
      serializeCookie("session", "value", {
        path: "/;\nInjected=1"
      })
    ).toThrow(TypeError);
  });
});
