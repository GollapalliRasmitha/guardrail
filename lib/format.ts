// Times are always shown in India time, the same on the server and in the browser (so the HTML the server sends
// and the page React builds match exactly — no "hydration mismatch").

const TIME = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** "20 Oct, 17:30:05" */
export function formatTime(value: string | Date): string {
  return TIME.format(typeof value === "string" ? new Date(value) : value).replace(/,?\s+(\d{2}:)/, ", $1");
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
}

const HOUR = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "17:00" in India time (chart axis labels). */
export function formatHour(value: string | Date): string {
  return HOUR.format(typeof value === "string" ? new Date(value) : value);
}
