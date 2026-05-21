import { createSealer } from "stateless-seal";

type Env = {
  SEAL_KEY_2026_05: string;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const sealer = createSealer({
      issuer: "cloudflare-worker-demo",
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

    const url = new URL(request.url);

    if (url.pathname === "/seal") {
      const token = await SessionToken.seal({
        userId: "user_123"
      });

      return Response.json({ token });
    }

    if (url.pathname === "/unseal") {
      const token = url.searchParams.get("token");

      if (!token) {
        return Response.json(
          { error: "missing_token" },
          { status: 400 }
        );
      }

      const result = await SessionToken.unseal(token);

      return Response.json(result);
    }

    return Response.json({
      message: "stateless-seal Cloudflare Workers example",
      routes: ["/seal", "/unseal?token=..."]
    });
  }
};