import { dubaiCalendarDate } from "@/lib/dubai-time";

const CALENDAR_DATE = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/u;

function isRealCalendarDate(value: string): boolean {
  if (!CALENDAR_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function validatedDubaiMorningDate(
  requested: string | undefined,
  now = new Date(),
): string {
  const today = dubaiCalendarDate(now);
  const value = requested?.trim();
  if (!value) return today;
  if (!isRealCalendarDate(value)) {
    throw new Error("MORNING_DATE must be a valid YYYY-MM-DD calendar date.");
  }
  if (value !== today) {
    throw new Error(
      `MORNING_DATE ${value} does not match the current Dubai date ${today}.`,
    );
  }
  return value;
}

export function isAutomatedMorningLane(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return environment.AUTOMATED_MORNING_LANE === "1";
}
