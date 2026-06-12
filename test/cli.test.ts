import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { logTestStep } from "./debug-log";

const execFileAsync = promisify(execFile);
const CLI_PATH = "bin/stateless-seal.mjs";

type Vector = {
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

  it("returns a non-zero exit for malformed tokens", async () => {
    await expect(runCli(["inspect", "not-a-token"])).rejects.toMatchObject({
      stderr: expect.stringContaining("Malformed Stateless Seal token.")
    });
  });

  it("prints the package version", async () => {
    const { stdout } = await runCli(["version"]);

    logTestStep("cli.version", stdout);

    expect(stdout.trim()).toBe("0.7.0");
  });
});
