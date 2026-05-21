export type CookieSameSite = "Strict" | "Lax" | "None";

export type CookieOptions = {
  domain?: string;
  path?: string;
  maxAge?: number;
  expires?: Date | number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: CookieSameSite;
};

const COOKIE_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {}
): string {
  assertCookieName(name);

  const encodedValue = encodeURIComponent(value);
  const parts = [`${name}=${encodedValue}`];

  if (options.maxAge !== undefined) {
    if (!Number.isFinite(options.maxAge)) {
      throw new TypeError("Cookie maxAge must be a finite number.");
    }

    parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  }

  if (options.domain !== undefined) {
    assertCookieAttributeValue("domain", options.domain);
    parts.push(`Domain=${options.domain}`);
  }

  if (options.path !== undefined) {
    assertCookieAttributeValue("path", options.path);
    parts.push(`Path=${options.path}`);
  }

  if (options.expires !== undefined) {
    const expires =
      options.expires instanceof Date
        ? options.expires
        : new Date(options.expires);

    if (!Number.isFinite(expires.getTime())) {
      throw new TypeError("Cookie expires must be a valid Date or timestamp.");
    }

    parts.push(`Expires=${expires.toUTCString()}`);
  }

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  if (options.secure) {
    parts.push("Secure");
  }

  if (options.sameSite !== undefined) {
    assertSameSite(options.sameSite);
    parts.push(`SameSite=${options.sameSite}`);
  }

  return parts.join("; ");
}

export function parseCookies(
  cookieHeader: string | null | undefined
): Record<string, string> {
  const cookies = Object.create(null) as Record<string, string>;

  if (!cookieHeader) {
    return cookies;
  }

  const pairs = cookieHeader.split(";");

  for (const pair of pairs) {
    const trimmed = pair.trim();

    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const name = trimmed.slice(0, separatorIndex);
    const value = trimmed.slice(separatorIndex + 1);

    if (!COOKIE_NAME_PATTERN.test(name)) {
      continue;
    }

    cookies[name] = decodeCookieValue(value);
  }

  return cookies;
}

export function getCookie(
  cookieHeader: string | null | undefined,
  name: string
): string | null {
  return parseCookies(cookieHeader)[name] ?? null;
}

export function clearCookie(
  name: string,
  options: Omit<CookieOptions, "maxAge" | "expires"> = {}
): string {
  return serializeCookie(name, "", {
    ...options,
    maxAge: 0,
    expires: new Date(0)
  });
}

function assertCookieName(name: string) {
  if (!COOKIE_NAME_PATTERN.test(name)) {
    throw new TypeError("Cookie name contains invalid characters.");
  }
}

function assertCookieAttributeValue(name: string, value: string) {
  if (/[\r\n;]/.test(value)) {
    throw new TypeError(`Cookie ${name} contains invalid characters.`);
  }
}

function assertSameSite(value: CookieSameSite) {
  if (value !== "Strict" && value !== "Lax" && value !== "None") {
    throw new TypeError("Cookie sameSite must be Strict, Lax, or None.");
  }
}

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
