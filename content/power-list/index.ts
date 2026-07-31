// Annual research registry. An edition is added only when its evidence review
// is complete.

import type { PowerListYear } from "./types";
export type {
  PowerListYear,
  PowerListEntry,
  PowerListCategory,
  PowerListEvidence,
} from "./types";

export const POWER_LISTS: PowerListYear[] = [];

export function getPowerListByYear(year: string): PowerListYear | null {
  return POWER_LISTS.find((edition) => edition.year === year) ?? null;
}

export function getAllPowerListYears(): string[] {
  return POWER_LISTS.map((edition) => edition.year);
}
