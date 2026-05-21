import type { TokenSchema } from "./types";

export type PayloadValidationResult<TPayload> =
  | {
      ok: true;
      payload: TPayload;
    }
  | {
      ok: false;
    };

export function validatePayload<TPayload>(
  schema: TokenSchema<TPayload> | undefined,
  payload: unknown
): PayloadValidationResult<TPayload> {
  if (!schema) {
    return {
      ok: true,
      payload: payload as TPayload
    };
  }

  try {
    if (hasSafeParse(schema)) {
      const result = schema.safeParse(payload);

      if (result.success) {
        return {
          ok: true,
          payload: result.data
        };
      }

      return {
        ok: false
      };
    }

    if (hasParse(schema)) {
      return {
        ok: true,
        payload: schema.parse(payload)
      };
    }

    return {
      ok: true,
      payload: schema(payload)
    };
  } catch {
    return {
      ok: false
    };
  }
}

function hasSafeParse<TPayload>(
  schema: TokenSchema<TPayload>
): schema is { safeParse(input: unknown): { success: true; data: TPayload } | { success: false } } {
  return (
    typeof schema === "object" &&
    schema !== null &&
    "safeParse" in schema &&
    typeof schema.safeParse === "function"
  );
}

function hasParse<TPayload>(
  schema: TokenSchema<TPayload>
): schema is { parse(input: unknown): TPayload } {
  return (
    typeof schema === "object" &&
    schema !== null &&
    "parse" in schema &&
    typeof schema.parse === "function"
  );
}
