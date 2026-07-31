export const DUBAI_TIME_ZONE = "Asia/Dubai";

export function dubaiCalendarDate(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Invalid date supplied to Dubai calendar formatter.");
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DUBAI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const year = part("year");
  const month = part("month");
  const day = part("day");
  if (!year || !month || !day) {
    throw new Error("Dubai calendar formatter returned incomplete parts.");
  }
  return `${year}-${month}-${day}`;
}
