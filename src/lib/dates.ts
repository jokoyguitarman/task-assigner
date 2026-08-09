// Business dates — due dates, schedule dates, the day a streak counts against —
// are calendar days in the restaurant's own timezone, not instants, and not days
// in whatever timezone the device happens to be set to.
//
// That distinction used to be glossed over: every helper here read the browser's
// clock. The scheduled jobs in the database work in the organization's timezone,
// so a branch tablet set wrong, or an owner opening the app from another country,
// would disagree with the server about which day it was and whether work was late.

// Set once when the organization loads, so the many callers of these helpers do
// not each have to thread it through. Falls back to the device zone, which is
// right for a phone sitting in the restaurant and is all we have before sign-in.
let appTimeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export const setAppTimeZone = (timeZone?: string | null): void => {
  if (timeZone) appTimeZone = timeZone;
};

export const getAppTimeZone = (): string => appTimeZone;

// How far the given zone is from UTC at that moment, in minutes. Derived from what
// the zone says the wall clock reads, which is the only way to get this without
// shipping a timezone database.
const offsetMinutes = (instant: Date, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant);

  const value = (type: string) => Number(parts.find(p => p.type === type)?.value ?? '0');

  const asUtc = Date.UTC(
    value('year'), value('month') - 1, value('day'),
    value('hour') % 24, value('minute'), value('second')
  );

  return (asUtc - instant.getTime()) / 60000;
};

// A Date rendered as the YYYY-MM-DD it falls on in the restaurant's timezone.
export const toDateOnly = (date: Date, timeZone: string = appTimeZone): string => {
  // en-CA formats as YYYY-MM-DD, which is exactly the shape Postgres wants for a
  // DATE column.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
};

// The inverse. A bare YYYY-MM-DD passed to the Date constructor is interpreted as
// UTC midnight, so it renders as the previous day anywhere west of Greenwich.
// Built at local midnight instead, because this value is only ever used for
// display and for comparing calendar days.
export const parseDateOnly = (value: string | Date): Date => {
  if (value instanceof Date) return value;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(value);

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

// The instant at which a wall-clock time occurs in the restaurant's timezone. This
// is what makes "due at 23:00" mean 23:00 there rather than 23:00 on the device.
//
// Guess an instant, ask the zone how far off it was, correct. Exact for zones
// without daylight saving, and off by an hour only for a time that falls inside a
// DST transition — Asia/Manila has none.
export const zonedWallClockToInstant = (
  dateOnly: string,
  time: string,
  timeZone: string = appTimeZone
): Date => {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);

  const guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  return new Date(guess - offsetMinutes(new Date(guess), timeZone) * 60000);
};

// Which calendar day a timestamp falls on in the restaurant's timezone. Distinct
// from toDateOnly only in intent: the input here is a real instant, not a day that
// was already chosen.
export const instantToLocalDate = (value: string | Date, timeZone: string = appTimeZone): string =>
  toDateOnly(value instanceof Date ? value : new Date(value), timeZone);

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};
