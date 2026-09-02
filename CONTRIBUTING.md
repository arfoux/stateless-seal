# Contributing to stateless-seal

Thanks for considering a contribution.

## Setup

```bash
npm ci
npm test
npm run build
npm run typecheck
```

Requires Node 18+ with Web Crypto (`globalThis.crypto`). See `docs/runtime-support.md`.

## Workflow

1. Fork and create a branch: `git checkout -b feat/your-feature`
2. Make changes with tests if applicable (`test/` + `vitest`).
3. Ensure CI passes: `npm run typecheck && npm test && npm run build`
4. Update docs if you change token format or API — see `SPEC.md` and `STABILITY.md`.
5. Commit with conventional style, push, open a Pull Request.

## Guidelines

- Keep `stseal.v1` format stable — no breaking changes without discussion (see `STABILITY.md`).
- Zero runtime dependencies — don't add deps without discussion.
- For security issues, see `SECURITY.md` and report via GitHub Issues (security) — do not open public issues for vulnerabilities.
- For questions, use GitHub Issues.

## Questions

Open an issue at https://github.com/arfoux/stateless-seal/issues
