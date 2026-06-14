import { SealError } from "../core/errors";

export function getWebCrypto(): Crypto {
  const webCrypto = globalThis.crypto;

  if (
    !webCrypto?.subtle ||
    typeof webCrypto.getRandomValues !== "function"
  ) {
    throw new SealError(
      "invalid_config",
      "Web Crypto API is not available in this runtime."
    );
  }

  return webCrypto;
}
