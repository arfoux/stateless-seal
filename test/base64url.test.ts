import { describe, expect, it } from "vitest";
import {
  base64urlDecode,
  base64urlEncode,
  base64urlDecodeJson,
  base64urlEncodeJson
} from "../src/token/base64url";

describe("base64url", () => {
  it("roundtrips bytes", () => {
    const input = new Uint8Array([0, 1, 2, 3, 252, 253, 254, 255]);
    const encoded = base64urlEncode(input);
    const decoded = base64urlDecode(encoded);

    expect([...decoded]).toEqual([...input]);
  });

  it("roundtrips json", () => {
    const input = {
      alg: "A256GCM",
      kid: "2026-05",
      pur: "session"
    };

    const encoded = base64urlEncodeJson(input);
    const decoded = base64urlDecodeJson<typeof input>(encoded);

    expect(decoded).toEqual(input);
  });

  it("does not emit padding", () => {
    const input = new Uint8Array([1, 2]);
    const encoded = base64urlEncode(input);

    expect(encoded.includes("=")).toBe(false);
  });

  it("rejects invalid characters", () => {
    expect(() => base64urlDecode("abc*")).toThrow();
  });
});