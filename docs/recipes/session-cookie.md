# Session Cookie

Use `stateless-seal/cookie-session` when you want a small encrypted session
cookie without a framework adapter.

```ts
import { createCookieSession } from "stateless-seal/cookie-session";

const SessionToken = sealer.defineToken<{
  userId: string;
  role: "user" | "admin";
}>({
  purpose: "session",
  ttl: "1h",
  audience: "web"
});

const session = createCookieSession({
  token: SessionToken,
  cookieName: "__Host-session"
});
```

Commit a session:

```ts
const setCookie = await session.commit({
  userId: "user_123",
  role: "user"
});

return new Response(null, {
  status: 204,
  headers: {
    "Set-Cookie": setCookie
  }
});
```

Read a session:

```ts
const result = await session.read(request);

if (!result.ok) {
  return new Response("Unauthorized", { status: 401 });
}

result.payload.userId;
```

Clear a session:

```ts
return new Response(null, {
  status: 204,
  headers: {
    "Set-Cookie": session.clear()
  }
});
```

Session cookies are still bearer tokens. Keep TTLs short and avoid placing
authorization decisions solely inside long-lived payloads.
