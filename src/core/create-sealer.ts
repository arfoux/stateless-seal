import type { SealerConfig, TokenDefinition, TokenPolicy } from "./types";
import { defineToken } from "./define-token";
import { SealError } from "./errors";

export function createSealer(config: SealerConfig) {
  validateConfig(config);

  const clock = config.clock ?? (() => Date.now());

  return {
    defineToken<TPayload = unknown>(
      policy: TokenPolicy<TPayload>
    ): TokenDefinition<TPayload> {
      return defineToken<TPayload>(
        {
          issuer: config.issuer,
          keys: config.keys,
          currentKeyId: config.currentKeyId,
          clock
        },
        policy
      );
    }
  };
}

function validateConfig(config: SealerConfig) {
  if (!config.issuer || typeof config.issuer !== "string") {
    throw new SealError("invalid_config", "Issuer is required.");
  }

  if (!config.keys || typeof config.keys !== "object") {
    throw new SealError("invalid_config", "Keys are required.");
  }

  if (!config.currentKeyId || typeof config.currentKeyId !== "string") {
    throw new SealError("invalid_config", "currentKeyId is required.");
  }

  if (!config.keys[config.currentKeyId]) {
    throw new SealError(
      "invalid_config",
      "currentKeyId must exist in the keys object."
    );
  }
}
