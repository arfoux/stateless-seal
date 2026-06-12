# Cookie Sessions

`stateless-seal/cookie-session` turns a token definition into a small
edge-safe cookie session helper.

It is framework-agnostic and has no runtime dependencies.

---

## Basic usage

```ts
import { createSealer } from "stateless-seal";
import { createCookieSession } from "stateless-seal/cookie-session";

const sealer = createSealer({
  issuer: "my-app",
  keys: {
    "2026-05": env.SEAL_KEY_2026_05
  },
  currentKeyId: "2026-05"
});

const SessionToken = sealer.defineToken<{ userId: string }>({
  purpose: "session",
  ttl: "1h",
  audience: "web"
});

const session = createCookieSession({
  token: SessionToken,
  cookieName: "__Host-session"
});
```

---

## Commit a session

`commit()` seals the payload and returns a `Set-Cookie` header value.

```ts
const setCookie = await session.commit({
  userId: "user_123"
});

return new Response(null, {
  status: 204,
  headers: {
    "Set-Cookie": setCookie
  }
});
```

Default cookie options are:

- `HttpOnly`
- `Secure`
- `SameSite=Lax`
- `Path=/`

You can override them when creating the session or per commit:

```ts
const session = createCookieSession({
  token: SessionToken,
  cookieName: "__Host-session",
  cookie: {
    sameSite: "Strict",
    maxAge: 60 * 60
  }
});

const setCookie = await session.commit(
  { userId: "user_123" },
  {
    cookie: {
      path: "/app"
    }
  }
);
```

---

## Read a session

`read()` accepts a raw `Cookie` header, a `Headers`-like object, or a
request-like object with `.headers`.

```ts
const result = await session.read(request);

if (!result.ok) {
  return new Response("Unauthorized", { status: 401 });
}

result.payload.userId;
```

Missing cookies return:

```ts
{
  ok: false,
  code: "missing_cookie"
}
```

Invalid tokens return the underlying `stateless-seal` error code, such as
`malformed_token`, `expired`, `decrypt_failed`, or `audience_mismatch`.

---

## Read or null

Use `readOrNull()` when you do not need the rejection reason.

```ts
const payload = await session.readOrNull(request);

if (!payload) {
  return new Response("Unauthorized", { status: 401 });
}
```

---

## Clear a session

`clear()` returns a clearing `Set-Cookie` header.

```ts
return new Response(null, {
  status: 204,
  headers: {
    "Set-Cookie": session.clear()
  }
});
```

---

## Seal options

`commit()` can pass seal options such as `notBefore`.

```ts
const setCookie = await session.commit(
  { userId: "user_123" },
  {
    seal: {
      notBefore: "10s"
    }
  }
);
```

---

## Security notes

- Prefer the `__Host-` cookie prefix for host-only secure cookies.
- Keep session TTLs short.
- Use `Secure` and `HttpOnly` in production.
- Do not expose detailed token rejection codes to browsers.
- For one-time flows such as magic links, use `oneTime` tokens and
  `unsealOnce()` with a replay store instead of a normal session cookie.
