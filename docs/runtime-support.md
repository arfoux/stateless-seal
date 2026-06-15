# Runtime Support

`stateless-seal` is designed for JavaScript runtimes with Web Crypto.

The core package avoids Node-only runtime APIs so it can be used in edge and
browser-like environments.

---

## Intended Runtime Targets

- Cloudflare Workers
- Vercel Edge
- Deno
- Bun
- Node.js 18+
- modern browsers with Web Crypto

---

## Core Runtime Rules

The core source under `src/` must not use:

- `Buffer`
- `fs`
- `path`
- `os`
- `node:crypto`
- CommonJS `require()`

The edge compatibility test scans `src/` for these patterns.

The CLI lives under `bin/` and is Node.js-only. It does not affect the edge
eligibility of the core SDK or subpath exports.

---

## CI Coverage

The GitHub Actions workflow runs the full development test suite:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

on:

- Node.js 20
- Node.js 22

It also runs a dedicated Node.js 18 runtime smoke check. That job builds the
package, imports every public subpath export, seals and unseals a token, and
runs the CLI help/keygen commands with Node.js 18 Web Crypto enabled.

Node.js 18 is tested this way because the package runtime supports Node.js 18,
while current Vitest/Rolldown development tooling requires newer Node.js APIs
for the full internal test runner.

Node.js 18 applications must expose Web Crypto as `globalThis.crypto`. If your
Node.js 18 environment does not expose it by default, run with
`--experimental-global-webcrypto` or install the runtime's Web Crypto global
before using `stateless-seal`. The core package intentionally does not import
`node:crypto`, because edge runtimes must remain eligible.

It also smoke-checks the built package exports:

- `stateless-seal`
- `stateless-seal/cloudflare`
- `stateless-seal/upstash`
- `stateless-seal/testing`
- `stateless-seal/cookie-session`

and runs the CLI help/keygen commands.

---

## What CI Does Not Prove

CI does not prove that every deployment platform is configured correctly.

Before deploying, verify:

- your runtime exposes Web Crypto
- your secrets are available in that runtime
- old keys stay deployed until old tokens expire
- replay stores are shared across all instances that need one-time semantics
- cookies have the right `Secure`, `HttpOnly`, `SameSite`, and `Path`
  attributes for your app

---

## Adding Runtime Coverage

Future runtime jobs should stay focused:

- import the built package
- seal and unseal a token
- inspect token metadata
- verify replay store adapters where applicable
- avoid framework-specific assumptions in core CI

Framework examples can have their own smoke tests if they grow beyond
documentation snippets.
