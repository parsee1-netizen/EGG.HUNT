/** What a business pays to hide one egg. */
export const EGG_PRICE_CENTS = 5;

export const MIN_EGGS = 10;
export const MAX_EGGS = 1000;
export const EGG_STEP = 10;
export const DROP_RADIUS_M = 400;

export function amountCents(eggCount: number): number {
  return eggCount * EGG_PRICE_CENTS;
}

export function assertEggCount(eggCount: number): void {
  if (!Number.isInteger(eggCount) || eggCount < MIN_EGGS || eggCount > MAX_EGGS || eggCount % EGG_STEP !== 0) {
    throw new Error(`Egg count must be ${MIN_EGGS}–${MAX_EGGS} in steps of ${EGG_STEP}.`);
  }
}

export function assertEmptyCount(emptyCount: number, eggCount: number): void {
  if (!Number.isInteger(emptyCount) || emptyCount < 0 || emptyCount > eggCount) {
    throw new Error("Empty eggs must be a whole number from 0 up to the batch size.");
  }
}

/** Share of the batch that still has a reward, rounded to the nearest percent. */
export function prizeOddsPercent(eggCount: number, emptyCount: number): number {
  if (eggCount <= 0) return 0;
  const prizes = Math.max(0, eggCount - emptyCount);
  return Math.round((prizes / eggCount) * 100);
}

/**
 * Indexes of empty eggs inside a batch. Spread across the drop so they are
 * not stacked on the same spot, and stable for a given count.
 */
export function emptyEggIndexes(eggCount: number, emptyCount: number): number[] {
  if (emptyCount <= 0 || eggCount <= 0) return [];
  const indexes: number[] = [];
  const count = Math.min(emptyCount, eggCount);
  for (let i = 0; i < count; i++) indexes.push(Math.floor((i * eggCount) / count));
  return indexes;
}
