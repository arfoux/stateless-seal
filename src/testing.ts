import { createSealer } from "./core/create-sealer";
import type {
  DurationInput,
  Keyring,
  SealKeyInput,
  SealerConfig
} from "./core/types";
import { parseTtl } from "./policy/ttl";

export const TEST_SEAL_KEY =
  "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8";
export const TEST_KEY_ID = "test-key";
export const TEST_ISSUER = "test-app";

export type TestClock = {
  now(): number;
  set(time: number | Date): number;
  advance(duration: DurationInput): number;
};

export type CreateTestSealerOptions = {
  issuer?: string;
  key?: SealKeyInput;
  keyId?: string;
  keys?: Keyring;
  currentKeyId?: string;
  now?: number | Date;
  maxTokenSize?: number;
};

export type TestSealer = {
  sealer: ReturnType<typeof createSealer>;
  clock: TestClock;
  issuer: string;
  keys: Keyring;
  currentKeyId: string;
};

export function createTestClock(initialTime: number | Date = 0): TestClock {
  let currentTime = normalizeTime(initialTime);

  return {
    now() {
      return currentTime;
    },

    set(time: number | Date) {
      currentTime = normalizeTime(time);
      return currentTime;
    },

    advance(duration: DurationInput) {
      currentTime += parseTtl(duration);
      return currentTime;
    }
  };
}

export function createTestSealer(
  options: CreateTestSealerOptions = {}
): TestSealer {
  const issuer = options.issuer ?? TEST_ISSUER;
  const clock = createTestClock(options.now);
  const currentKeyId = resolveCurrentKeyId(options);
  const keys =
    options.keys ??
    ({
      [currentKeyId]: options.key ?? TEST_SEAL_KEY
    } satisfies Keyring);

  const config: SealerConfig = {
    issuer,
    keys,
    currentKeyId,
    clock: clock.now
  };

  if (options.maxTokenSize !== undefined) {
    config.maxTokenSize = options.maxTokenSize;
  }

  return {
    sealer: createSealer(config),
    clock,
    issuer,
    keys,
    currentKeyId
  };
}

function resolveCurrentKeyId(options: CreateTestSealerOptions): string {
  if (options.currentKeyId !== undefined) {
    return options.currentKeyId;
  }

  if (options.keyId !== undefined) {
    return options.keyId;
  }

  if (options.keys !== undefined) {
    const keyIds = Object.keys(options.keys);

    if (keyIds.length === 1 && keyIds[0] !== undefined) {
      return keyIds[0];
    }

    throw new TypeError(
      "currentKeyId or keyId is required when test keys has multiple entries."
    );
  }

  return TEST_KEY_ID;
}

function normalizeTime(time: number | Date): number {
  const value = time instanceof Date ? time.getTime() : time;

  if (!Number.isFinite(value)) {
    throw new TypeError("Test clock time must be a finite timestamp.");
  }

  return value;
}
