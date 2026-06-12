import { createSealer } from "stateless-seal";
import { createCookieSession } from "stateless-seal/cookie-session";

type Env = {
  SEAL_KEY_2026_05: string;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const sealer = createSealer({
      issuer: "recipe-demo",
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
      cookieName: "__Host-session",
      cookie: {
        maxAge: 60 * 60
      }
    });

    const url = new URL(request.url);

    if (url.pathname === "/login") {
      return new Response(null, {
        status: 204,
        headers: {
          "Set-Cookie": await session.commit({
            userId: "user_123"
          })
        }
      });
    }

    if (url.pathname === "/me") {
      const result = await session.read(request);

      if (!result.ok) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }

      return Response.json({
        userId: result.payload.userId
      });
    }

    if (url.pathname === "/logout") {
      return new Response(null, {
        status: 204,
        headers: {
          "Set-Cookie": session.clear()
        }
      });
    }

    return Response.json({
      routes: ["/login", "/me", "/logout"]
    });
  }
};
