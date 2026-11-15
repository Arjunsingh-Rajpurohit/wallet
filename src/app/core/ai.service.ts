import { Injectable, inject } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { dayKey } from './dates';
import type { ExpenseCategory, MealType, PaymentMethod } from './db';
import { SettingsService } from './settings.service';

/** Thrown with a message that can be shown to the user as-is. */
export class AiError extends Error {}

export interface ScannedFood {
  name: string;
  portion: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodScan {
  items: ScannedFood[];
  note: string;
}

export interface BillScan {
  merchant: string;
  date: string;
  total: number;
  category: ExpenseCategory;
  payment: PaymentMethod;
  note: string;
}

export interface AiMealIdea {
  name: string;
  portion: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  why: string;
}

const CATEGORY_KEYS: ExpenseCategory[] = ['food', 'groceries', 'transport', 'shopping', 'bills', 'health', 'fitness', 'fun', 'rent', 'education', 'travel', 'other'];
const PAYMENT_KEYS: PaymentMethod[] = ['upi', 'cash', 'card', 'other'];

// Gemini's response schema (OpenAPI subset): upper-case type names.
const S = (type: string, extra: object = {}) => ({ type, ...extra });
const FOOD_ITEM = S('OBJECT', {
  properties: {
    name: S('STRING'), portion: S('STRING'), kcal: S('INTEGER'),
    protein: S('NUMBER'), carbs: S('NUMBER'), fat: S('NUMBER'),
  },
  required: ['name', 'portion', 'kcal', 'protein', 'carbs', 'fat'],
});

const FOOD_SCHEMA = S('OBJECT', {
  properties: { items: S('ARRAY', { items: FOOD_ITEM }), note: S('STRING') },
  required: ['items', 'note'],
});

const BILL_SCHEMA = S('OBJECT', {
  properties: {
    merchant: S('STRING'), date: S('STRING'), total: S('NUMBER'),
    category: S('STRING', { enum: CATEGORY_KEYS }), payment: S('STRING', { enum: PAYMENT_KEYS }), note: S('STRING'),
  },
  required: ['merchant', 'date', 'total', 'category', 'payment', 'note'],
});

const IDEAS_SCHEMA = S('OBJECT', {
  properties: {
    ideas: S('ARRAY', {
      items: S('OBJECT', {
        properties: {
          name: S('STRING'), portion: S('STRING'), kcal: S('INTEGER'), protein: S('NUMBER'),
          carbs: S('NUMBER'), fat: S('NUMBER'), why: S('STRING'),
        },
        required: ['name', 'portion', 'kcal', 'protein', 'carbs', 'fat', 'why'],
      }),
    }),
  },
  required: ['ideas'],
});

const FOOD_PROMPT = `You are a nutrition expert who knows Indian and international food well.
Look at this meal photo. List each separate food item you can see, with a realistic portion and the nutrition for THAT portion.
For Indian dishes use home-style portions (1 roti about 40 g, 1 katori dal about 150 ml) unless the photo clearly shows otherwise.
kcal is a whole number; protein, carbs and fat are grams with at most one decimal.
If something is unclear, make your best guess and say so in "note" in one short sentence.
If there is no food in the photo, return an empty items list and say so in "note".`;

const billPrompt = (today: string) => `Read this shop bill or receipt. It is most likely from India, amounts in rupees.
Return:
- merchant: the shop or restaurant name.
- date: the bill date as YYYY-MM-DD. Indian bills write the day first (05/10/2026 is 5 October 2026). Today is ${today}. Empty string if not printed.
- total: the final amount actually paid, after tax and discounts (the grand total / net payable). 0 if you cannot read it.
- category: the best fit for what was bought.
- payment: how it was paid if printed (UPI, cash, card), else "other".
- note: one short sentence if anything was unclear, else an empty string.`;

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly settings = inject(SettingsService);

  async scanFood(base64: string, mimeType: string): Promise<FoodScan> {
    const out = await this.ask<FoodScan>([{ inlineData: { mimeType, data: base64 } }, { text: FOOD_PROMPT }], FOOD_SCHEMA);
    return {
      note: out.note ?? '',
      items: (out.items ?? []).map((i) => ({
        name: i.name, portion: i.portion ?? '',
        kcal: Math.max(0, Math.round(i.kcal)), protein: positive(i.protein), carbs: positive(i.carbs), fat: positive(i.fat),
      })),
    };
  }

  async readBill(base64: string, mimeType: string): Promise<BillScan> {
    const out = await this.ask<BillScan>([{ inlineData: { mimeType, data: base64 } }, { text: billPrompt(dayKey()) }], BILL_SCHEMA);
    return {
      ...out,
      total: positive(out.total),
      category: CATEGORY_KEYS.includes(out.category) ? out.category : 'other',
      payment: PAYMENT_KEYS.includes(out.payment) ? out.payment : 'other',
    };
  }

  async suggestMeals(context: { kcal: number; protein: number; diet: string; slot: MealType; eaten: string[] }): Promise<AiMealIdea[]> {
    const prompt = `Suggest 3 simple meals for my ${context.slot}.
I have ${context.kcal} kcal and ${context.protein} g protein left for today. My diet: ${context.diet}.
Already eaten today: ${context.eaten.length ? context.eaten.join(', ') : 'nothing yet'}.
Prefer common Indian home food that is easy to make or buy. Give the portion, kcal, protein, carbs and fat for that portion, and one short reason (under 12 words).`;
    const out = await this.ask<{ ideas: AiMealIdea[] }>([{ text: prompt }], IDEAS_SCHEMA);
    return (out.ideas ?? []).slice(0, 3);
  }

  /** A one-word round trip, to prove the key works before relying on it. */
  async test(key: string, model: string): Promise<void> {
    await this.call(key, model, [{ text: 'Reply with the single word OK.' }], undefined);
  }

  private async ask<T>(parts: object[], schema: object): Promise<T> {
    const ai = await this.settings.aiNow();
    if (!ai.key) throw new AiError('Add your free Gemini key in Settings to use this.');
    const text = await this.call(ai.key, ai.model, parts, schema);
    try {
      return JSON.parse(text.replace(/^```(?:json)?|```$/g, '').trim()) as T;
    } catch {
      throw new AiError("The AI's answer couldn't be read. Please try again.");
    }
  }

  private async call(key: string, model: string, parts: object[], schema: object | undefined): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: schema
        ? { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.2 }
        : { temperature: 0 },
    };
    const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': key };

    let status: number;
    let data: any;
    try {
      // Native HTTP on the phone: no browser CORS rules in the way.
      if (Capacitor.isNativePlatform()) {
        const res = await CapacitorHttp.post({ url, headers, data: body, connectTimeout: 20000, readTimeout: 90000 });
        status = res.status;
        data = typeof res.data === 'string' ? safeJson(res.data) : res.data;
      } else {
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        status = res.status;
        data = safeJson(await res.text());
      }
    } catch {
      throw new AiError('No internet connection. Photo reading needs internet — everything else works offline.');
    }

    if (status === 429) throw new AiError('Free AI limit reached for now. Wait a minute and try again.');
    if (status === 400 && /api key/i.test(data?.error?.message ?? '')) throw new AiError('That Gemini key is not valid. Check it in Settings.');
    if (status === 403) throw new AiError('That Gemini key is not allowed to use this model. Check it in Settings.');
    if (status === 404) throw new AiError(`Model "${model}" was not found. Reset the model in Settings.`);
    if (status >= 400) throw new AiError(`The AI could not answer (${status}). Try again in a moment.`);

    const candidate = data?.candidates?.[0];
    const text = (candidate?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('').trim();
    if (!text) {
      throw new AiError(candidate?.finishReason === 'SAFETY'
        ? "The AI wouldn't read this photo. Please enter it yourself."
        : 'The AI gave an empty answer. Try a clearer photo.');
    }
    return text;
  }
}

function positive(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? Math.round(v * 10) / 10 : 0;
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
