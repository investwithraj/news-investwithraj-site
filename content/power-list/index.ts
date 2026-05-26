// Power List registry. Annual. Manually edited by Raj — not driven by cron.

import type { PowerListYear } from "./types";
export type { PowerListYear, PowerListEntry, PowerListCategory } from "./types";

export const POWER_LISTS: PowerListYear[] = [
  // 2026 list goes here when Raj edits it. Placeholder year-block lives in
  // app/power-list/[year]/page.tsx — renders an editorial "in production"
  // call-out when this array is empty.
];

export function getPowerListByYear(year: string): PowerListYear | null {
  return POWER_LISTS.find((p) => p.year === year) ?? null;
}

export function getAllPowerListYears(): string[] {
  return POWER_LISTS.map((p) => p.year);
}
