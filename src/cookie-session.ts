import {
  clearCookie,
  getCookie,
  serializeCookie,
  type CookieOptions
} from "./cookie";
import type {
  SealErrorCode,
  SealOptions,
  TokenDefinition,
  TokenMeta
} from "./core/types";

export type CookieHeaderGetter = {
  get(name: string): string | null;
};

export type CookieHeaderSource =
  | string
  | null
  | undefined
  | CookieHeaderGetter
  | {
      headers: CookieHeaderGetter;
    };

export type CookieSessionOptions<TPayload> = {
  token: Pick<TokenDefinition<TPayload>, "seal" | "unseal">;
  cookieName: string;
  cookie?: CookieOptions;
};

export type CookieSessionCommitOptions = {
  seal?: SealOptions;
  cookie?: CookieOptions;
};

export type CookieSessionClearOptions = {
  cookie?: Omit<CookieOptions, "maxAge" | "expires">;
};

export type CookieSessionReadErrorCode = SealErrorCode | "missing_cookie";

export type CookieSessionReadResult<TPayload> =
  | {
      ok: true;
      payload: TPayload;
      meta: TokenMeta;
    }
  | {
      ok: false;
      code: CookieSessionReadErrorCode;
    };

export type CookieSession<TPayload> = {
  cookieName: string;
  commit(
    payload: TPayload,
    options?: CookieSessionCommitOptions
  ): Promise<string>;
  read(source: CookieHeaderSource): Promise<CookieSessionReadResult<TPayload>>;
  readOrNull(source: CookieHeaderSource): Promise<TPayload | null>;
  clear(options?: CookieSessionClearOptions): string;
};

const DEFAULT_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "Lax",
  path: "/"
};

export function createCookieSession<TPayload>(
  options: CookieSessionOptions<TPayload>
): CookieSession<TPayload> {
  const baseCookie = {
    ...DEFAULT_COOKIE_OPTIONS,
    ...options.cookie
  };

  async function commit(
    payload: TPayload,
    commitOptions: CookieSessionCommitOptions = {}
  ): Promise<string> {
    const token = await options.token.seal(payload, commitOptions.seal);

    return serializeCookie(
      options.cookieName,
      token,
      mergeCookieOptions(baseCookie, commitOptions.cookie)
    );
  }

  async function read(
    source: CookieHeaderSource
  ): Promise<CookieSessionReadResult<TPayload>> {
    const token = getCookie(readCookieHeader(source), options.cookieName);

    if (token === null) {
      return {
        ok: false,
        code: "missing_cookie"
      };
    }

    return options.token.unseal(token) as Promise<
      CookieSessionReadResult<TPayload>
    >;
  }

  async function readOrNull(source: CookieHeaderSource): Promise<TPayload | null> {
    const result = await read(source);

    if (!result.ok) {
      return null;
    }

    return result.payload;
  }

  function clear(clearOptions: CookieSessionClearOptions = {}): string {
    return clearCookie(
      options.cookieName,
      mergeClearCookieOptions(baseCookie, clearOptions.cookie)
    );
  }

  return {
    cookieName: options.cookieName,
    commit,
    read,
    readOrNull,
    clear
  };
}

function readCookieHeader(source: CookieHeaderSource): string | null {
  if (source === null || source === undefined) {
    return null;
  }

  if (typeof source === "string") {
    return source;
  }

  if (isHeaderGetter(source)) {
    return source.get("Cookie") ?? source.get("cookie");
  }

  return source.headers.get("Cookie") ?? source.headers.get("cookie");
}

function mergeCookieOptions(
  base: CookieOptions,
  override: CookieOptions | undefined
): CookieOptions {
  return {
    ...base,
    ...override
  };
}

function mergeClearCookieOptions(
  base: CookieOptions,
  override: Omit<CookieOptions, "maxAge" | "expires"> | undefined
): Omit<CookieOptions, "maxAge" | "expires"> {
  const merged = {
    ...base,
    ...override
  };
  const { maxAge: _maxAge, expires: _expires, ...clearOptions } = merged;

  return clearOptions;
}

function isHeaderGetter(value: unknown): value is CookieHeaderGetter {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { get?: unknown }).get === "function"
  );
}
