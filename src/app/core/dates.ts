import type { DayKey, MealType } from './db';

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(d: Date = new Date()): DayKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Noon avoids a daylight-saving jump turning one day into two. */
export function parseDay(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(key: DayKey, days: number): DayKey {
  const d = parseDay(key);
  d.setDate(d.getDate() + days);
  return dayKey(d);
}

/** Every day from `from` to `to`, both included. */
export function daysBetween(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

export function monthKey(key: DayKey): string {
  return key.slice(0, 7);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1, 12);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function monthRange(month: string): { from: DayKey; to: DayKey } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${pad(last)}` };
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

/** "Today", "Yesterday", or "Sat, 18 Oct". */
export function dayLabel(key: DayKey, today: DayKey = dayKey()): string {
  if (key === today) return 'Today';
  if (key === addDays(today, -1)) return 'Yesterday';
  return parseDay(key).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function shortDay(key: DayKey): string {
  return parseDay(key).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function weekdayLetter(key: DayKey): string {
  return parseDay(key).toLocaleDateString('en-IN', { weekday: 'narrow' });
}

/** The meal you are most likely logging right now. */
export function mealTypeNow(d: Date = new Date()): MealType {
  const h = d.getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 19) return 'snack';
  return 'dinner';
}
