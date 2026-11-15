import { dayKey } from './dates';
import type { DayKey, ExpenseCategory, PaymentMethod } from './db';

/** One line of text read off the bill, with its position when the reader gives one. */
export interface OcrLine {
  text: string;
  top?: number;
  bottom?: number;
  left?: number;
}

export interface BillGuess {
  total: number | null;
  date: DayKey | null;
  merchant: string | null;
  category: ExpenseCategory;
  payment: PaymentMethod | null;
}

// Strongest wording wins: "Net payable" beats "Total amount", which beats a bare "Total".
const TOTAL_TIERS: RegExp[] = [
  /(grand\s*total|net\s*(?:total|amount|amt|payable|bill)|amount\s*payable|amt\s*payable|total\s*payable|payable\s*amount|to\s*pay\b|amount\s*due|balance\s*due)/i,
  /(total\s*amount|total\s*amt|bill\s*amount|bill\s*total|total\s*(?:rs|inr|₹)|invoice\s*total)/i,
  /\btotal\b/i,
];
const NOT_A_TOTAL = /(sub\s*-?\s*total|total\s*(?:qty|quantity|items?|tax|gst|cgst|sgst|igst|savings?|saved|discount|weight|wt|mrp)|taxable|you\s*saved)/i;

// (?!\d) stops "18%" from backtracking into a stray "1".
const AMOUNT = /(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?!\d)(?!\s*%)/gi;
const DATE_OR_TIME = /\b\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4}\b|\b\d{1,2}:\d{2}(?::\d{2})?\b/g;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const CATEGORY_WORDS: [ExpenseCategory, RegExp][] = [
  ['travel', /(makemytrip|goibibo|airlines?|indigo|air\s*india|vistara|akasa|flight|resort|oyo|airbnb|booking\.com)/i],
  ['fun', /(pvr|inox|cinema|cinepolis|movie|bookmyshow|netflix|spotify|hotstar|prime\s*video|gaming|amusement)/i],
  ['transport', /(petrol|diesel|fuel|filling\s*station|indian\s*oil|iocl|bharat\s*petroleum|bpcl|hpcl|hindustan\s*petroleum|\bshell\b|uber|\bola\b|rapido|metro|parking|\btoll\b|fastag|irctc|railway|\bcab\b|taxi)/i],
  ['health', /(pharma|pharmacy|chemist|medical|medicos|apollo|medplus|netmeds|hospital|clinic|diagnostic|pathology|\bdr\.)/i],
  ['fitness', /(\bgym\b|fitness|decathlon|yoga|sports)/i],
  ['bills', /(electricity|power\s*bill|water\s*bill|gas\s*bill|broadband|wi-?fi|internet|recharge|airtel|\bjio\b|vodafone|bsnl|\bdth\b|tata\s*play|postpaid|prepaid)/i],
  ['education', /(school|college|tuition|course|udemy|coursera|stationery|university|book\s*store)/i],
  ['rent', /(\brent\b|lease|landlord)/i],
  ['groceries', /(\bmart\b|grocery|grocer|supermarket|super\s*market|kirana|provision|d-?mart|reliance\s*fresh|smart\s*bazaar|more\s*retail|bigbasket|blinkit|zepto|instamart|vegetables?)/i],
  ['food', /(restaurant|caf[eé]|hotel|dhaba|kitchen|pizza|burger|biryani|swiggy|zomato|domino|mcdonald|\bkfc\b|subway|starbucks|bakery|sweets|eatery|canteen|haldiram|dine|food)/i],
  ['shopping', /(fashion|apparel|clothing|garments|footwear|shoes|electronics|amazon|flipkart|myntra|ajio|lifestyle|pantaloons|westside|zara|croma|reliance\s*digital|\bmall\b|store|\bshop\b)/i],
];

const NOT_A_NAME = /(tax\s*invoice|invoice|receipt|bill\s*(?:no|#)|cash\s*memo|gstin|\bgst\b|fssai|\bph(?:one)?\b|\btel\b|mob(?:ile)?|e-?mail|www\.|\.com|@|\bdate\b|\btime\b|order|table|token|welcome|thank|address|road|\brd\b|nagar|street)/i;

function amountsIn(text: string): number[] {
  const cleaned = text.replace(DATE_OR_TIME, ' ');
  const out: number[] = [];
  for (const m of cleaned.matchAll(AMOUNT)) {
    const raw = m[1].replace(/,/g, '');
    // Phone numbers, GSTINs and bill numbers are long digit runs, never prices.
    if (raw.split('.')[0].length > 7) continue;
    const value = Number(raw);
    if (value > 0) out.push(value);
  }
  return out;
}

const centre = (l: OcrLine) => ((l.top ?? 0) + (l.bottom ?? 0)) / 2;

/** The figure printed next to a label: same line, else the same row, else the line below. */
function valueBeside(lines: OcrLine[], i: number, keyword: RegExp): number | null {
  const line = lines[i];
  const afterLabel = line.text.slice((line.text.search(keyword) ?? 0) + 1);
  const own = amountsIn(afterLabel);
  if (own.length) return own[own.length - 1];

  if (line.top !== undefined && line.bottom !== undefined) {
    const rowMates = lines
      .filter((other, j) => j !== i && other.top !== undefined && centre(other) >= line.top! && centre(other) <= line.bottom!
        && (other.left ?? 0) >= (line.left ?? 0))
      .sort((a, b) => (a.left ?? 0) - (b.left ?? 0));
    for (const mate of rowMates) {
      const found = amountsIn(mate.text);
      if (found.length) return found[found.length - 1];
    }
  }

  const next = lines[i + 1];
  if (next && !/[a-z]{3,}/i.test(next.text)) {
    const found = amountsIn(next.text);
    if (found.length) return found[0];
  }
  return null;
}

export function findTotal(lines: OcrLine[]): number | null {
  for (const tier of TOTAL_TIERS) {
    let found: number | null = null;
    lines.forEach((line, i) => {
      if (!tier.test(line.text)) return;
      if (NOT_A_TOTAL.test(line.text) && !TOTAL_TIERS[0].test(line.text)) return;
      const value = valueBeside(lines, i, tier);
      // The last match in reading order: totals sit at the bottom of a bill.
      if (value !== null) found = value;
    });
    if (found !== null) return found;
  }
  // No label read: the biggest figure that looks like money (paise or a ₹ sign).
  const money = lines.flatMap((l) => (/[.,]\d{2}\b|₹|rs\.?/i.test(l.text) ? amountsIn(l.text) : []));
  return money.length ? Math.max(...money) : null;
}

function validDay(y: number, m: number, d: number, today: DayKey): DayKey | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1) return null;
  const last = new Date(y, m, 0).getDate();
  if (d > last) return null;
  const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  // A bill is never from the future, and rarely older than two years.
  if (key > today || y < Number(today.slice(0, 4)) - 2) return null;
  return key;
}

/** Indian bills write day first: 05/10/2026 is 5 October. */
export function findDate(text: string, today: DayKey = dayKey()): DayKey | null {
  const tries: (() => DayKey | null)[] = [];
  for (const m of text.matchAll(/\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/g)) {
    tries.push(() => validDay(+m[1], +m[2], +m[3], today));
  }
  for (const m of text.matchAll(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g)) {
    const [d, mo, y] = [+m[1], +m[2], +m[3]];
    tries.push(() => validDay(y, mo, d, today) ?? (d <= 12 ? validDay(y, d, mo, today) : null));
  }
  for (const m of text.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?[\s\-\/.,]*([a-z]{3})[a-z]*[\s\-\/.,']*(\d{2,4})\b/gi)) {
    const mo = MONTHS.indexOf(m[2].toLowerCase()) + 1;
    if (mo) tries.push(() => validDay(+m[3], mo, +m[1], today));
  }
  for (const m of text.matchAll(/\b([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/gi)) {
    const mo = MONTHS.indexOf(m[1].toLowerCase()) + 1;
    if (mo) tries.push(() => validDay(+m[3], mo, +m[2], today));
  }
  // Earliest in the text first — the bill date is printed near the top.
  for (const attempt of tries) {
    const found = attempt();
    if (found) return found;
  }
  return null;
}

export function findMerchant(lines: OcrLine[]): string | null {
  for (const line of lines.slice(0, 6)) {
    const text = line.text.replace(/\s+/g, ' ').trim();
    const letters = (text.match(/[a-z]/gi) ?? []).length;
    if (letters < 3 || letters < text.length / 2 || NOT_A_NAME.test(text)) continue;
    const name = text.replace(/^[^a-z0-9]+|[^a-z0-9)]+$/gi, '').slice(0, 60);
    return name === name.toUpperCase() ? name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : name;
  }
  return null;
}

export function guessCategory(text: string): ExpenseCategory {
  return CATEGORY_WORDS.find(([, words]) => words.test(text))?.[0] ?? 'other';
}

export function guessPayment(text: string): PaymentMethod | null {
  if (/(\bupi\b|gpay|google\s*pay|phonepe|phone\s*pe|paytm|\bbhim\b)/i.test(text)) return 'upi';
  if (/(\bcard\b|\bvisa\b|master\s*card|rupay|debit|credit|amex)/i.test(text)) return 'card';
  if (/\bcash\b/i.test(text)) return 'cash';
  return null;
}

/** Reads what it can from a bill's text. Anything it can't find stays empty for you to fill. */
export function parseBill(lines: OcrLine[], today: DayKey = dayKey()): BillGuess {
  const text = lines.map((l) => l.text).join('\n');
  return {
    total: findTotal(lines),
    date: findDate(text, today),
    merchant: findMerchant(lines),
    category: guessCategory(text),
    payment: guessPayment(text),
  };
}
