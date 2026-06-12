import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { logTestStep } from "./debug-log";

const FORBIDDEN_RUNTIME_PATTERNS = [
  /\bBuffer\b/,
  /from\s+["']node:/,
  /from\s+["']fs["']/,
  /from\s+["']path["']/,
  /from\s+["']os["']/,
  /from\s+["']crypto["']/,
  /\brequire\s*\(/
];

function collectTsFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
      continue;
    }

    if (entry.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("edge runtime compatibility", () => {
  it("does not use Node.js runtime APIs in src", () => {
    const files = collectTsFiles("src");

    logTestStep("edge-compat.scan", {
      files: files.length,
      forbiddenPatterns: FORBIDDEN_RUNTIME_PATTERNS.map((pattern) =>
        pattern.toString()
      )
    });

    for (const file of files) {
      const content = readFileSync(file, "utf8");

      for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
        expect(
          content,
          `${file} contains forbidden runtime pattern ${pattern}`
        ).not.toMatch(pattern);
      }
    }
  });
});
