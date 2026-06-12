import { createSealer } from "stateless-seal";
import { cloudflareKVReplayStore } from "stateless-seal/cloudflare";

type Env = {
  SEAL_KEY_2026_05: string;
  REPLAY_KV: KVNamespace;
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

    const PasswordResetToken = sealer.defineToken<{ userId: string }>({
      purpose: "password-reset",
      ttl: "15m",
      audience: "web",
      oneTime: true
    });

    const replayStore = cloudflareKVReplayStore(env.REPLAY_KV);
    const url = new URL(request.url);

    if (url.pathname === "/create-password-reset") {
      const token = await PasswordResetToken.seal({
        userId: "user_123"
      });

      return Response.json({
        url: `https://example.com/reset-password?token=${encodeURIComponent(
          token
        )}`
      });
    }

    if (url.pathname === "/verify-password-reset") {
      const token = url.searchParams.get("token");

      if (!token) {
        return Response.json({ error: "missing_token" }, { status: 400 });
      }

      const result = await PasswordResetToken.unsealOnce(token, {
        store: replayStore
      });

      if (!result.ok) {
        return Response.json({ error: "invalid_token" }, { status: 401 });
      }

      return Response.json({
        userId: result.payload.userId
      });
    }

    return Response.json({
      routes: [
        "/create-password-reset",
        "/verify-password-reset?token=..."
      ]
    });
  }
};
