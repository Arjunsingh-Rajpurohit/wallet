import { daysBetween, parseDay, shortDay, weekdayLetter } from './dates';
import type { DayKey } from './db';

export interface Series {
  labels: string[];
  values: (number | null)[];
  /** What one bar stands for, for the chart title: "per day", "weekly average"… */
  unit: string;
}

/**
 * Turns per-day numbers into bars that stay readable: daily up to a month,
 * weekly for a quarter, monthly for a year. `sum` adds a bucket up (minutes trained);
 * `avg` gives the daily average inside it (steps).
 */
export function toSeries(from: DayKey, to: DayKey, byDay: Map<DayKey, number>, mode: 'sum' | 'avg'): Series {
  const days = daysBetween(from, to);
  if (days.length <= 31) {
    return {
      labels: days.map((d) => (days.length <= 7 ? weekdayLetter(d) : shortDay(d))),
      values: days.map((d) => byDay.get(d) ?? 0),
      unit: 'per day',
    };
  }

  const weekly = days.length <= 120;
  const buckets: { label: string; days: DayKey[] }[] = [];
  for (const d of days) {
    const month = parseDay(d).toLocaleDateString('en-IN', { month: 'short' });
    const last = buckets[buckets.length - 1];
    const fits = last && (weekly ? last.days.length < 7 : last.label === month);
    if (fits) last.days.push(d);
    else buckets.push({ label: weekly ? shortDay(d) : month, days: [d] });
  }
  return {
    labels: buckets.map((b) => b.label),
    values: buckets.map((b) => {
      const total = b.days.reduce((s, d) => s + (byDay.get(d) ?? 0), 0);
      return Math.round(mode === 'avg' ? total / b.days.length : total);
    }),
    unit: mode === 'avg' ? (weekly ? 'daily average, by week' : 'daily average, by month') : (weekly ? 'per week' : 'per month'),
  };
}
