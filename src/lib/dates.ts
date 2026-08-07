// Business dates — due dates, schedule dates, the day a streak counts against —
// are calendar days in the restaurant's own timezone, not instants. Serialising
// one with toISOString() converts to UTC first, which moves an evening edit in
// Manila onto the previous day. These helpers keep calendar days and instants
// from being confused for each other.

// A Date rendered as the YYYY-MM-DD the user is actually living in.
export const toDateOnly = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// The inverse. A bare YYYY-MM-DD passed to the Date constructor is interpreted
// as UTC midnight, so it renders as the previous day anywhere west of Greenwich.
export const parseDateOnly = (value: string | Date): Date => {
  if (value instanceof Date) return value;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(value);

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

// Which calendar day a timestamp falls on locally. Distinct from toDateOnly only
// in intent: the input here is a real instant, not a day that was already chosen.
export const instantToLocalDate = (value: string | Date): string =>
  toDateOnly(value instanceof Date ? value : new Date(value));

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};
