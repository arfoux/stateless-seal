import { execFile } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { logTestStep } from "./debug-log";

const execFileAsync = promisify(execFile);
const CLI_PATH = "bin/stateless-seal.mjs";
const PACKAGE_VERSION = (
  JSON.parse(readFileSync("package.json", "utf8")) as { version: string }
).version;

type Vector = {
  key: string;
  token: string;
};

async function runCli(args: string[]) {
  return execFileAsync(process.execPath, [CLI_PATH, ...args], {
    cwd: process.cwd()
  });
}

function loadValidBasicToken(): string {
  const vector = JSON.parse(
    readFileSync("test-vectors/v1/valid-basic.json", "utf8")
  ) as Vector;

  return vector.token;
}

describe("CLI", () => {
  it("prints help", async () => {
    const { stdout } = await runCli(["--help"]);

    logTestStep("cli.help", stdout);

    expect(stdout).toContain("stateless-seal");
    expect(stdout).toContain("keygen");
    expect(stdout).toContain("inspect");
    expect(stdout).toContain("seal");
    expect(stdout).toContain("unseal");
  });

  it("generates a base64url 32-byte key", async () => {
    const { stdout } = await runCli(["keygen"]);
    const key = stdout.trim();

    logTestStep("cli.keygen", {
      key,
      length: key.length
    });

    expect(key).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(key).toHaveLength(43);
  });

  it("inspects public token metadata", async () => {
    const token = loadValidBasicToken();
    const { stdout } = await runCli(["inspect", token]);

    logTestStep("cli.inspect", stdout);

    expect(stdout).toContain("Token: stseal");
    expect(stdout).toContain("Version: v1");
    expect(stdout).toContain("Algorithm: A256GCM");
    expect(stdout).toContain("Key ID: 2026-05");
    expect(stdout).toContain("Purpose: password-reset");
    expect(stdout).toContain("Issuer: example-app");
    expect(stdout).toContain("Audience: (none)");
    expect(stdout).toContain("Verified: no");
  });

  it("inspects public token metadata as json", async () => {
    const token = loadValidBasicToken();
    const { stdout } = await runCli(["inspect", token, "--json"]);
    const output = JSON.parse(stdout) as {
      token: string;
      version: string;
      algorithm: string;
      keyId: string;
      purpose: string;
      issuer: string;
      verified: boolean;
    };

    logTestStep("cli.inspect-json", output);

    expect(output).toMatchObject({
      token: "stseal",
      version: "v1",
      algorithm: "A256GCM",
      keyId: "2026-05",
      purpose: "password-reset",
      issuer: "example-app",
      verified: false
    });
  });

  it("seals and unseals a JSON payload", async () => {
    const vector = JSON.parse(
      readFileSync("test-vectors/v1/valid-basic.json", "utf8")
    ) as Vector;
    const { stdout: sealStdout } = await runCli([
      "seal",
      "--key",
      vector.key,
      "--kid",
      "2026-05",
      "--issuer",
      "example-app",
      "--purpose",
      "password-reset",
      "--audience",
      "web",
      "--ttl",
      "5m",
      "--payload",
      "{\"userId\":\"user_123\"}"
    ]);
    const token = sealStdout.trim();

    const { stdout: unsealStdout } = await runCli([
      "unseal",
      token,
      "--key",
      vector.key,
      "--issuer",
      "example-app",
      "--purpose",
      "password-reset",
      "--audience",
      "web"
    ]);
    const payload = JSON.parse(unsealStdout) as { userId: string };

    logTestStep("cli.seal-unseal", {
      tokenPrefix: token.slice(0, 11),
      payload
    });

    expect(token).toMatch(/^stseal\.v1\./);
    expect(payload).toEqual({
      userId: "user_123"
    });
  });

  it("unseals a JSON payload with metadata output", async () => {
    const vector = JSON.parse(
      readFileSync("test-vectors/v1/valid-basic.json", "utf8")
    ) as Vector;
    const { stdout: sealStdout } = await runCli([
      "seal",
      "--key",
      vector.key,
      "--kid",
      "2026-05",
      "--issuer",
      "example-app",
      "--purpose",
      "password-reset",
      "--ttl",
      "5m",
      "--payload",
      "{\"userId\":\"user_123\"}"
    ]);
    const token = sealStdout.trim();
    const { stdout } = await runCli([
      "unseal",
      token,
      "--key",
      vector.key,
      "--issuer",
      "example-app",
      "--purpose",
      "password-reset",
      "--json"
    ]);
    const output = JSON.parse(stdout) as {
      ok: boolean;
      payload: { userId: string };
      meta: {
        keyId: string;
        purpose: string;
        issuer: string;
      };
    };

    logTestStep("cli.unseal-json", output);

    expect(output).toMatchObject({
      ok: true,
      payload: {
        userId: "user_123"
      },
      meta: {
        keyId: "2026-05",
        purpose: "password-reset",
        issuer: "example-app"
      }
    });
  });

  it("seals a JSON payload from a file", async () => {
    const vector = JSON.parse(
      readFileSync("test-vectors/v1/valid-basic.json", "utf8")
    ) as Vector;
    const payloadPath = "cli-payload.tmp.json";

    writeFileSync(payloadPath, "{\"userId\":\"user_file\"}", "utf8");

    try {
      const { stdout: sealStdout } = await runCli([
        "seal",
        "--key",
        vector.key,
        "--kid",
        "2026-05",
        "--issuer",
        "example-app",
        "--purpose",
        "password-reset",
        "--ttl",
        "5m",
        "--payload-file",
        payloadPath
      ]);
      const { stdout } = await runCli([
        "unseal",
        sealStdout.trim(),
        "--key",
        vector.key,
        "--issuer",
        "example-app",
        "--purpose",
        "password-reset"
      ]);
      const payload = JSON.parse(stdout) as { userId: string };

      logTestStep("cli.seal-payload-file", payload);

      expect(payload).toEqual({
        userId: "user_file"
      });
    } finally {
      unlinkSync(payloadPath);
    }
  });

  it("returns a non-zero exit for a CLI binding mismatch", async () => {
    const vector = JSON.parse(
      readFileSync("test-vectors/v1/valid-basic.json", "utf8")
    ) as Vector;
    const { stdout } = await runCli([
      "seal",
      "--key",
      vector.key,
      "--kid",
      "2026-05",
      "--issuer",
      "example-app",
      "--purpose",
      "password-reset",
      "--ttl",
      "5m",
      "--payload",
      "{\"userId\":\"user_123\"}"
    ]);

    await expect(
      runCli([
        "unseal",
        stdout.trim(),
        "--key",
        vector.key,
        "--issuer",
        "example-app",
        "--purpose",
        "session"
      ])
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("purpose_mismatch")
    });
  });

  it("returns a non-zero exit for malformed tokens", async () => {
    await expect(runCli(["inspect", "not-a-token"])).rejects.toMatchObject({
      stderr: expect.stringContaining("Malformed Stateless Seal token.")
    });
  });

  it("prints the package version", async () => {
    const { stdout } = await runCli(["version"]);

    logTestStep("cli.version", stdout);

    expect(stdout.trim()).toBe(PACKAGE_VERSION);
  });
});
