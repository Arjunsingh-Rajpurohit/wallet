import { daysBetween } from './dates';
import type { DayKey, StepEntry, WaterEntry, WeightEntry, Workout } from './db';

export interface WeekSummary {
  /** Average over the days something was eaten — a day with nothing logged is not a zero. */
  kcalAvg: number | null;
  proteinAvg: number | null;
  kcalDays: number;
  stepsAvg: number | null;
  workouts: number;
  workoutMinutes: number;
  waterAvgMl: number | null;
  /** Newest weight minus the oldest in the week; null with fewer than two entries. */
  weightChange: number | null;
  routinePct: number | null;
}

export interface WeekInput {
  from: DayKey;
  to: DayKey;
  food: { date: DayKey; kcal: number; protein: number }[];
  steps: StepEntry[];
  workouts: Workout[];
  water: WaterEntry[];
  weights: WeightEntry[];
  routine: { done: number; total: number }[];
}

const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/** The last seven days in a few numbers. Example: 3 days eaten 1,800 / 2,000 / 2,200 → 2,000 kcal a day. */
export function weekSummary(w: WeekInput): WeekSummary {
  const days = new Set(daysBetween(w.from, w.to));
  const eaten = w.food.filter((d) => days.has(d.date) && d.kcal > 0);
  const weights = w.weights.filter((x) => days.has(x.date)).sort((a, b) => a.date.localeCompare(b.date));
  const routine = w.routine.reduce((s, r) => ({ done: s.done + r.done, total: s.total + r.total }), { done: 0, total: 0 });
  const round = (n: number | null) => (n === null ? null : Math.round(n));
  return {
    kcalAvg: round(avg(eaten.map((d) => d.kcal))),
    proteinAvg: round(avg(eaten.map((d) => d.protein))),
    kcalDays: eaten.length,
    stepsAvg: round(avg(w.steps.filter((s) => days.has(s.date) && s.steps > 0).map((s) => s.steps))),
    workouts: w.workouts.filter((x) => days.has(x.date)).length,
    workoutMinutes: w.workouts.filter((x) => days.has(x.date)).reduce((s, x) => s + x.minutes, 0),
    waterAvgMl: round(avg(w.water.filter((x) => days.has(x.date) && x.ml > 0).map((x) => x.ml))),
    weightChange: weights.length > 1 ? Math.round((weights[weights.length - 1].kg - weights[0].kg) * 10) / 10 : null,
    routinePct: routine.total ? Math.round((routine.done / routine.total) * 100) : null,
  };
}
