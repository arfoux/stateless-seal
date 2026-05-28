import type { SealerConfig, TokenDefinition, TokenPolicy } from "./types";
import { defineToken } from "./define-token";
import { SealError } from "./errors";
import {
  isValidIssuer,
  isValidKeyId,
  isValidMaxTokenSize
} from "./validation";

export const DEFAULT_MAX_TOKEN_SIZE = 16 * 1024;

export function createSealer(config: SealerConfig) {
  validateConfig(config);

  const clock = config.clock ?? (() => Date.now());
  const maxTokenSize = config.maxTokenSize ?? DEFAULT_MAX_TOKEN_SIZE;

  return {
    defineToken<TPayload = unknown>(
      policy: TokenPolicy<TPayload>
    ): TokenDefinition<TPayload> {
      return defineToken<TPayload>(
        {
          issuer: config.issuer,
          keys: config.keys,
          currentKeyId: config.currentKeyId,
          maxTokenSize,
          clock
        },
        policy
      );
    }
  };
}

function validateConfig(config: SealerConfig) {
  if (!isValidIssuer(config.issuer)) {
    throw new SealError(
      "invalid_config",
      "Issuer must be 1-256 safe identifier characters."
    );
  }

  if (!config.keys || typeof config.keys !== "object") {
    throw new SealError("invalid_config", "Keys are required.");
  }

  if (!isValidKeyId(config.currentKeyId)) {
    throw new SealError(
      "invalid_config",
      "currentKeyId must be 1-128 safe identifier characters."
    );
  }

  for (const keyId of Object.keys(config.keys)) {
    if (!isValidKeyId(keyId)) {
      throw new SealError(
        "invalid_config",
        "Key ids must be 1-128 safe identifier characters."
      );
    }
  }

  if (!config.keys[config.currentKeyId]) {
    throw new SealError(
      "invalid_config",
      "currentKeyId must exist in the keys object."
    );
  }

  if (
    config.maxTokenSize !== undefined &&
    !isValidMaxTokenSize(config.maxTokenSize)
  ) {
    throw new SealError(
      "invalid_config",
      "maxTokenSize must be a positive integer."
    );
  }
}
