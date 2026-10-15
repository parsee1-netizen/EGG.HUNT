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
