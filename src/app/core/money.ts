import { addMonths, monthKey, monthRange } from './dates';
import type { DayKey, Expense } from './db';

/** Money that came in (salary, a refund…) rather than went out. */
export const isIn = (e: Pick<Expense, 'kind'>) => e.kind === 'in';

export function totals(rows: Expense[]): { spent: number; got: number } {
  let spent = 0;
  let got = 0;
  for (const e of rows) {
    if (isIn(e)) got += e.amount;
    else spent += e.amount;
  }
  return { spent, got };
}

/** The same day next month; the 31st becomes the month's last day (31 Jan → 28 Feb → 31 Mar). */
export function nextMonthly(date: DayKey, day: number): DayKey {
  const month = addMonths(monthKey(date), 1);
  const last = Number(monthRange(month).to.slice(8));
  return `${month}-${String(Math.min(day, last)).padStart(2, '0')}`;
}

/**
 * "Repeat every month": the entries that have come due and are not in the list yet.
 * Each series is carried by its newest entry; unticking Repeat on that one ends it.
 * Example: rent ₹18,000 on 1 Oct with Repeat, opened on 15 Dec → 1 Nov and 1 Dec are added.
 */
export function dueRepeats(rows: Expense[], today: DayKey): Omit<Expense, 'id'>[] {
  const newest = new Map<string, Expense>();
  const seen = new Set<string>();
  for (const e of rows) {
    if (!e.series) continue;
    seen.add(`${e.series}|${e.date}`);
    const have = newest.get(e.series);
    if (!have || e.date > have.date || (e.date === have.date && e.createdAt > have.createdAt)) newest.set(e.series, e);
  }
  const out: Omit<Expense, 'id'>[] = [];
  for (const e of newest.values()) {
    if (!e.repeat) continue;
    const day = e.repeatDay ?? Number(e.date.slice(8));
    // At most two years of catching up, however long the app stayed closed.
    for (let date = nextMonthly(e.date, day), n = 0; date <= today && n < 24; date = nextMonthly(date, day), n++) {
      if (seen.has(`${e.series}|${date}`)) continue;
      const { id: _id, bill: _bill, ...copy } = e;
      out.push({ ...copy, date, repeatDay: day, createdAt: Date.now() + n });
    }
    // Only the newest entry of a series keeps carrying it.
  }
  return out;
}

/** What is left to spend per day until the month ends, today included. Null when over budget or no budget. */
export function perDayLeft(budget: number | null, spent: number, today: DayKey): number | null {
  if (!budget || spent >= budget) return null;
  const days = Number(monthRange(monthKey(today)).to.slice(8)) - Number(today.slice(8)) + 1;
  return Math.floor((budget - spent) / days);
}

const cell = (v: string | number) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** A sheet Excel and Google Sheets open: one line per entry, newest first. */
export function toCsv(rows: Expense[], label: (e: Expense) => { category: string; payment: string }): string {
  const lines = [['Date', 'Type', 'Amount', 'Category', 'Shop / from', 'Paid by', 'Repeats', 'Note'].join(',')];
  for (const e of [...rows].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)) {
    const l = label(e);
    lines.push([e.date, isIn(e) ? 'Got' : 'Spent', e.amount, l.category, e.merchant ?? '', isIn(e) ? '' : l.payment,
      e.repeat ? 'Every month' : '', e.note ?? ''].map(cell).join(','));
  }
  // The mark at the start makes Excel read ₹ and Hindi names correctly.
  return `﻿${lines.join('\r\n')}`;
}
