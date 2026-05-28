const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9._:/@-]+$/;
const PURPOSE_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/;

export function isValidKeyId(value: unknown): value is string {
  return isSafeIdentifier(value, 128);
}

export function isValidIssuer(value: unknown): value is string {
  return isSafeIdentifier(value, 256);
}

export function isValidAudience(value: unknown): value is string {
  return isSafeIdentifier(value, 256);
}

export function isValidPurpose(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 128 &&
    PURPOSE_PATTERN.test(value)
  );
}

export function isValidMaxTokenSize(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function isSafeIdentifier(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= maxLength &&
    SAFE_IDENTIFIER_PATTERN.test(value)
  );
}
