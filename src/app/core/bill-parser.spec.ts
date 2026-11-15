import { findDate, findMerchant, findTotal, guessCategory, guessPayment, parseBill, type OcrLine } from './bill-parser';

const lines = (text: string): OcrLine[] => text.trim().split('\n').map((t) => ({ text: t.trim() }));
const TODAY = '2026-10-18';

describe('bill parser', () => {
  it('reads a restaurant bill: grand total wins over sub total and tax', () => {
    const bill = lines(`
      SPICE GARDEN RESTAURANT
      12, MG Road, Ahmedabad
      GSTIN: 24ABCDE1234F1Z5
      Bill No: 4521   Date: 14/10/2026 21:14
      Paneer Tikka        1   320.00
      Butter Naan         2   120.00
      Sub Total               440.00
      CGST 2.5%                11.00
      SGST 2.5%                11.00
      Grand Total             462.00
      Paid by UPI
    `);
    const guess = parseBill(bill, TODAY);
    expect(guess.total).toBe(462);
    expect(guess.date).toBe('2026-10-14');
    expect(guess.merchant).toBe('Spice Garden Restaurant');
    expect(guess.category).toBe('food');
    expect(guess.payment).toBe('upi');
  });

  it('net payable beats a bigger total amount before discount', () => {
    expect(findTotal(lines(`
      Total Amount   1,250.00
      Discount         150.00
      Net Payable    1,100.00
    `))).toBe(1100);
  });

  it('takes the amount from the same row when the reader splits columns apart', () => {
    const split: OcrLine[] = [
      { text: 'D MART', top: 0, bottom: 20, left: 100 },
      { text: 'Total Qty: 7', top: 300, bottom: 320, left: 10 },
      { text: 'Total', top: 400, bottom: 420, left: 10 },
      { text: 'Items 7', top: 430, bottom: 450, left: 10 },
      { text: '₹ 1,284.50', top: 402, bottom: 418, left: 300 },
    ];
    expect(findTotal(split)).toBe(1284.5);
  });

  it('ignores percentages, phone numbers and GST numbers', () => {
    expect(findTotal(lines(`
      Ph: 9876543210
      Total (incl. 18% GST)   590.00
    `))).toBe(590);
  });

  it('falls back to the largest money-looking figure when no total label is read', () => {
    expect(findTotal(lines(`
      Item A   120.00
      Item B   80.50
      Rs. 200.50
    `))).toBe(200.5);
  });

  it('reads Indian day-first dates and month names, never a future date', () => {
    expect(findDate('Date: 05/10/2026', TODAY)).toBe('2026-10-05');
    expect(findDate('Dt 5-Oct-26', TODAY)).toBe('2026-10-05');
    expect(findDate('Oct 5, 2026', TODAY)).toBe('2026-10-05');
    expect(findDate('2026-09-30', TODAY)).toBe('2026-09-30');
    expect(findDate('Valid till 31/12/2026', TODAY)).toBeNull();
  });

  it('skips address and GST lines when picking the shop name', () => {
    expect(findMerchant(lines(`
      TAX INVOICE
      GSTIN 24AAAAA0000A1Z5
      Apollo Pharmacy
    `))).toBe('Apollo Pharmacy');
  });

  it('guesses the category and payment from words on the bill', () => {
    expect(guessCategory('INDIAN OIL petrol pump')).toBe('transport');
    expect(guessCategory('Blinkit order')).toBe('groceries');
    expect(guessCategory('PVR cinemas')).toBe('fun');
    expect(guessCategory('something unknown')).toBe('other');
    expect(guessPayment('Paid via PhonePe')).toBe('upi');
    expect(guessPayment('VISA **** 1234')).toBe('card');
    expect(guessPayment('CASH TENDERED 500')).toBe('cash');
  });
});
