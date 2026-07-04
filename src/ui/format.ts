const MS_PER_TENTH = 100;
const TENTHS_PER_SECOND = 10;
const SECONDS_PER_MINUTE = 60;

export function formatTimeMs(ms: number): string {
  const clamped = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalTenths = Math.floor(clamped / MS_PER_TENTH);
  const tenths = totalTenths % TENTHS_PER_SECOND;
  const totalSeconds = Math.floor(totalTenths / TENTHS_PER_SECOND);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
}
