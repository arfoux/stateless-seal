export function parseTtl(ttl: string | number): number {
  if (typeof ttl === "number") {
    if (!Number.isFinite(ttl) || ttl <= 0) {
      throw new Error("TTL number must be positive.");
    }

    return ttl;
  }

  const match = /^(\d+)(ms|s|m|h|d)$/.exec(ttl);

  if (!match) {
    throw new Error(
      'Invalid TTL format. Use number in milliseconds or string like "15m", "1h", "7d".'
    );
  }

  const value = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case "ms":
      return value;
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error("Unsupported TTL unit.");
  }
}