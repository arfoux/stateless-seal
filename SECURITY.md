# Security Policy

## Supported Versions

`stateless-seal` is currently pre-1.0. Security fixes are intended for the
latest published minor version.

Once v1.0 is released, supported versions will be listed here explicitly.

## Reporting a Vulnerability

Please do not open a public GitHub issue for suspected vulnerabilities.

Use GitHub's private vulnerability reporting feature for this repository when
available. If private reporting is unavailable, contact the maintainer
privately before public disclosure.

Useful details to include:

- affected package version
- runtime where the issue was observed
- minimal reproduction
- expected behavior
- actual behavior
- impact assessment if known

## Security Scope

Reports are in scope when they affect:

- token forgery resistance
- payload confidentiality
- AES-GCM authentication
- purpose, issuer, or audience bypass
- expiry or not-before enforcement
- key handling
- replay protection once replay APIs exist
- denial-of-service behavior caused by malformed tokens

Reports are usually out of scope when they are only about:

- application authorization logic outside this package
- leaked application secrets or environment variables
- unsafe key storage by the application
- replay of valid stateless tokens without a replay store
- phishing, social engineering, or account recovery policy choices

## Disclosure Expectations

The maintainer will try to:

1. Acknowledge the report.
2. Reproduce and assess the issue.
3. Prepare a fix when appropriate.
4. Publish a patched version.
5. Credit the reporter if requested.

Please allow reasonable time for assessment and remediation before public
disclosure.

## Public Error Handling

`stateless-seal` exposes detailed error codes for developers. Applications
should avoid returning those details to untrusted clients.

Prefer:

```ts
if (!result.ok) {
  return new Response("Invalid token", { status: 401 });
}
```

Log detailed rejection codes internally instead.

