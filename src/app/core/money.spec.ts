import { describe, expect, it } from 'vitest';
import type { Expense } from './db';
import { dueRepeats, nextMonthly, perDayLeft, toCsv, totals } from './money';

const row = (o: Partial<Expense>): Expense => ({ id: 1, date: '2026-10-01', amount: 100, category: 'food', payment: 'upi', createdAt: 1, ...o });

describe('money in and out', () => {
  it('adds spent and got apart', () => {
    expect(totals([row({ amount: 250 }), row({ amount: 50000, kind: 'in', category: 'salary' }), row({ amount: 100 })]))
      .toEqual({ spent: 350, got: 50000 });
  });

  it('what is left per day', () => {
    // ₹20,000 budget, ₹5,000 spent, 15 Nov: 16 days left (15…30) → ₹937 a day.
    expect(perDayLeft(20000, 5000, '2026-11-15')).toBe(937);
    expect(perDayLeft(20000, 21000, '2026-11-15')).toBeNull();
    expect(perDayLeft(null, 100, '2026-11-15')).toBeNull();
  });
});

describe('repeat every month', () => {
  it('the 31st follows the month end', () => {
    expect(nextMonthly('2026-01-31', 31)).toBe('2026-02-28');
    expect(nextMonthly('2026-02-28', 31)).toBe('2026-03-31');
    expect(nextMonthly('2026-12-05', 5)).toBe('2027-01-05');
  });

  it('adds every month that came due, once', () => {
    const rent = row({ id: 7, date: '2026-10-01', amount: 18000, category: 'rent', series: 's1', repeat: true, bill: 'bills/x.jpg' });
    const due = dueRepeats([rent], '2026-12-15');
    expect(due.map((e) => e.date)).toEqual(['2026-11-01', '2026-12-01']);
    expect(due[0]).toMatchObject({ amount: 18000, category: 'rent', series: 's1', repeat: true });
    expect('id' in due[0] || 'bill' in due[0]).toBe(false);
    // Opened again the same day: nothing new.
    const after = [rent, ...due.map((e, i) => ({ ...e, id: 10 + i }) as Expense)];
    expect(dueRepeats(after, '2026-12-15')).toEqual([]);
  });

  it('not due yet, and stopped series, add nothing', () => {
    expect(dueRepeats([row({ date: '2026-11-20', series: 's1', repeat: true })], '2026-12-15')).toEqual([]);
    // Repeat unticked on the newest entry ends the series, even if older ones still say repeat.
    const old = row({ id: 1, date: '2026-09-01', series: 's1', repeat: true });
    const stopped = row({ id: 2, date: '2026-10-01', series: 's1', repeat: false, createdAt: 2 });
    expect(dueRepeats([old, stopped], '2026-12-15')).toEqual([]);
  });
});

describe('export', () => {
  it('one line per entry, commas and quotes kept safe', () => {
    const csv = toCsv([row({ merchant: 'D-Mart, Bopal', note: 'say "hi"' }), row({ date: '2026-10-05', amount: 50000, kind: 'in', category: 'salary' })],
      (e) => ({ category: e.category, payment: 'UPI' }));
    const lines = csv.replace('﻿', '').split('\r\n');
    expect(lines[0]).toBe('Date,Type,Amount,Category,Shop / from,Paid by,Repeats,Note');
    expect(lines[1]).toBe('2026-10-05,Got,50000,salary,,,,');
    expect(lines[2]).toBe('2026-10-01,Spent,100,food,"D-Mart, Bopal",UPI,,"say ""hi"""');
  });
});
