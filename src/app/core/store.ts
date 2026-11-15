import { addDays, dayKey, daysBetween } from './dates';
import { dueRepeats, totals } from './money';
import {
  db, type DayKey, type Expense, type Habit, type Meal, type ProgressItem, type StepEntry,
  type WaterEntry, type WeightEntry, type Workout,
} from './db';

/* ---------- Reads (wrap in live() so screens refresh on every save) ---------- */

export interface Totals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const NO_TOTALS: Totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function sumMeals(meals: Meal[]): Totals {
  return meals.reduce((t, m) => ({
    kcal: t.kcal + m.kcal, protein: t.protein + m.protein, carbs: t.carbs + m.carbs, fat: t.fat + m.fat,
  }), NO_TOTALS);
}

export function mealsOn(date: DayKey): Promise<Meal[]> {
  return db.meals.where('date').equals(date).sortBy('createdAt');
}

/** Calories per day for a range; days with nothing logged are 0. */
export async function kcalByDay(from: DayKey, to: DayKey): Promise<{ date: DayKey; kcal: number; protein: number }[]> {
  const meals = await db.meals.where('date').between(from, to, true, true).toArray();
  const byDay = new Map<DayKey, { kcal: number; protein: number }>();
  for (const m of meals) {
    const d = byDay.get(m.date) ?? { kcal: 0, protein: 0 };
    byDay.set(m.date, { kcal: d.kcal + m.kcal, protein: d.protein + m.protein });
  }
  return daysBetween(from, to).map((date) => ({ date, ...(byDay.get(date) ?? { kcal: 0, protein: 0 }) }));
}

export const stepsBetween = (from: DayKey, to: DayKey): Promise<StepEntry[]> =>
  db.steps.where('date').between(from, to, true, true).toArray();

export const weightsBetween = (from: DayKey, to: DayKey): Promise<WeightEntry[]> =>
  db.weights.where('date').between(from, to, true, true).toArray();

export const workoutsBetween = (from: DayKey, to: DayKey): Promise<Workout[]> =>
  db.workouts.where('date').between(from, to, true, true).reverse().sortBy('date');

export const expensesBetween = (from: DayKey, to: DayKey): Promise<Expense[]> =>
  db.expenses.where('date').between(from, to, true, true).toArray()
    .then((rows) => rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt));

export async function spentBetween(from: DayKey, to: DayKey): Promise<number> {
  return totals(await db.expenses.where('date').between(from, to, true, true).toArray()).spent;
}

export const waterOn = (date: DayKey): Promise<number> => db.water.get(date).then((w) => w?.ml ?? 0);
export const waterBetween = (from: DayKey, to: DayKey): Promise<WaterEntry[]> =>
  db.water.where('date').between(from, to, true, true).toArray();

export interface HabitStatus {
  habit: Habit;
  done: boolean;
  streak: number;
}

/**
 * Each habit with today's tick and its streak. A streak counts back from today,
 * or from yesterday while today is still open — not ticking yet doesn't break it.
 */
export async function routineOn(date: DayKey): Promise<HabitStatus[]> {
  const habits = await db.habits.orderBy('order').toArray();
  if (!habits.length) return [];
  const checks = await db.habitChecks.where('date').between(addDays(date, -400), date, true, true).toArray();
  const doneDays = new Map<number, Set<DayKey>>();
  for (const c of checks) {
    if (!doneDays.has(c.habitId)) doneDays.set(c.habitId, new Set());
    doneDays.get(c.habitId)!.add(c.date);
  }
  return habits.map((habit) => {
    const days = doneDays.get(habit.id!) ?? new Set<DayKey>();
    const done = days.has(date);
    let streak = 0;
    for (let d = done ? date : addDays(date, -1); days.has(d); d = addDays(d, -1)) streak++;
    return { habit, done, streak };
  });
}

/** Per day: habits ticked out of habits that existed that day. */
export async function routineScore(from: DayKey, to: DayKey): Promise<{ date: DayKey; done: number; total: number }[]> {
  const habits = await db.habits.toArray();
  const checks = await db.habitChecks.where('date').between(from, to, true, true).toArray();
  const live = new Set(habits.map((h) => h.id));
  return daysBetween(from, to).map((date) => ({
    date,
    total: habits.filter((h) => h.since <= date).length,
    done: checks.filter((c) => c.date === date && live.has(c.habitId)).length,
  }));
}

/* ---------- Writes ---------- */

export function addMeals(meals: Omit<Meal, 'id' | 'createdAt'>[]): Promise<unknown> {
  const now = Date.now();
  return db.meals.bulkAdd(meals.map((m, i) => ({ ...m, createdAt: now + i })));
}

export const updateMeal = (id: number, changes: Partial<Meal>) => db.meals.update(id, changes);

/** A photo may be shared by several items from one scan — keep it while any still uses it. */
export async function deleteMeal(meal: Meal): Promise<string | undefined> {
  await db.meals.delete(meal.id!);
  if (meal.photo && (await db.meals.filter((m) => m.photo === meal.photo).count()) === 0) return meal.photo;
  return undefined;
}

export const logWeight = (date: DayKey, kg: number) => db.weights.put({ date, kg, createdAt: Date.now() });
export const deleteWeight = (date: DayKey) => db.weights.delete(date);

export const logSteps = (date: DayKey, steps: number) => db.steps.put({ date, steps, source: 'manual' });
export const deleteSteps = (date: DayKey) => db.steps.delete(date);

export const addWorkout = (w: Omit<Workout, 'id' | 'createdAt'>) => db.workouts.add({ ...w, createdAt: Date.now() });
export const deleteWorkout = (id: number) => db.workouts.delete(id);

export async function addHabit(name: string, emoji: string, since: DayKey): Promise<unknown> {
  const last = await db.habits.orderBy('order').last();
  return db.habits.add({ name, emoji, order: (last?.order ?? 0) + 1, since });
}

export async function deleteHabit(id: number): Promise<void> {
  await db.transaction('rw', db.habits, db.habitChecks, async () => {
    await db.habitChecks.where('habitId').equals(id).delete();
    await db.habits.delete(id);
  });
}

export async function setHabitDone(habitId: number, date: DayKey, done: boolean): Promise<void> {
  const existing = await db.habitChecks.where('[habitId+date]').equals([habitId, date]).first();
  if (done && !existing) await db.habitChecks.add({ habitId, date });
  if (!done && existing) await db.habitChecks.delete(existing.id!);
}

export const addExpense = (e: Omit<Expense, 'id' | 'createdAt'>) => db.expenses.add({ ...e, createdAt: Date.now() });
export const updateExpense = (id: number, changes: Partial<Expense>) => db.expenses.update(id, changes);
export const deleteExpense = (id: number) => db.expenses.delete(id);

/** Ends a "repeat every month" series: what is already in the list stays, nothing new is added. */
export async function stopSeries(series: string): Promise<void> {
  const rows = await db.expenses.filter((e) => e.series === series && !!e.repeat).toArray();
  await db.expenses.bulkPut(rows.map(({ repeat: _r, ...e }) => e));
}

/** Adds (or with a minus, takes back) water for a day; never below zero. */
export async function addWater(date: DayKey, ml: number): Promise<void> {
  await db.transaction('rw', db.water, async () => {
    const now = (await db.water.get(date))?.ml ?? 0;
    const next = Math.max(0, now + ml);
    if (next) await db.water.put({ date, ml: next });
    else await db.water.delete(date);
  });
}

/** "Repeat every month" entries that came due since the app was last open. Returns how many were added. */
export async function addDueRepeats(today: DayKey = dayKey()): Promise<number> {
  return db.transaction('rw', db.expenses, async () => {
    const due = dueRepeats(await db.expenses.filter((e) => !!e.series).toArray(), today);
    if (due.length) await db.expenses.bulkAdd(due);
    return due.length;
  });
}

export const addProgress = (p: Omit<ProgressItem, 'id' | 'createdAt'>) => db.progress.add({ ...p, createdAt: Date.now() });
export const deleteProgress = (id: number) => db.progress.delete(id);
