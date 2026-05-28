import type { ReplayStore, ReplayStoreConsumeResult } from "../core/types";

export type MemoryReplayStoreOptions = {
  clock?: () => number;
};

export function memoryReplayStore(
  options: MemoryReplayStoreOptions = {}
): ReplayStore {
  const consumed = new Map<string, number>();
  const clock = options.clock ?? (() => Date.now());

  return {
    async consume(
      id: string,
      expiresAt: number
    ): Promise<ReplayStoreConsumeResult> {
      const existingExpiresAt = consumed.get(id);

      if (existingExpiresAt !== undefined) {
        if (clock() <= existingExpiresAt) {
          return "replayed";
        }

        consumed.delete(id);
      }

      consumed.set(id, expiresAt);
      return "ok";
    }
  };
}
