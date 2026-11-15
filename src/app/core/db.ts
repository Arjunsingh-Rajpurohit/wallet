import Dexie, { type EntityTable } from 'dexie';
import { DB_NAME } from './variant';

/** Calendar day in the phone's own time zone, e.g. "2026-10-18". */
export type DayKey = string;

export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export type MealSource = 'manual' | 'food-list' | 'photo-ai' | 'idea';
export type Diet = 'vegan' | 'veg' | 'egg' | 'nonveg';

export interface Meal {
  id?: number;
  date: DayKey;
  type: MealType;
  name: string;
  /** Serving text shown under the name, e.g. "2 × 1 roti". */
  portion?: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  photo?: string;
  source: MealSource;
  createdAt: number;
}

export interface WeightEntry {
  date: DayKey;
  kg: number;
  createdAt: number;
}

export interface StepEntry {
  date: DayKey;
  steps: number;
  source: 'manual' | 'phone';
}

export type WorkoutType = 'walk' | 'run' | 'gym' | 'yoga' | 'cycling' | 'swim' | 'sports' | 'hiit' | 'other';

export interface Workout {
  id?: number;
  date: DayKey;
  type: WorkoutType;
  minutes: number;
  kcal: number;
  note?: string;
  createdAt: number;
}

export interface Habit {
  id?: number;
  name: string;
  emoji: string;
  order: number;
  /** First day the habit counts towards the routine score. */
  since: DayKey;
}

export interface HabitCheck {
  id?: number;
  habitId: number;
  date: DayKey;
}

export type ExpenseCategory =
  | 'food' | 'groceries' | 'transport' | 'shopping' | 'bills' | 'health'
  | 'fitness' | 'fun' | 'rent' | 'education' | 'travel' | 'other'
  // Money in.
  | 'salary' | 'business' | 'gift' | 'refund' | 'interest';
export type PaymentMethod = 'upi' | 'cash' | 'card' | 'other';

export interface Expense {
  id?: number;
  date: DayKey;
  amount: number;
  category: ExpenseCategory;
  merchant?: string;
  note?: string;
  payment: PaymentMethod;
  bill?: string;
  /** 'in' = money that came in; absent = money spent. */
  kind?: 'in';
  /** "Repeat every month": the entries of one repeating series share this id… */
  series?: string;
  /** …the newest one carries it on while this is true… */
  repeat?: boolean;
  /** …on this day of the month (31 = the last day in shorter months). */
  repeatDay?: number;
  createdAt: number;
}

/** Glasses of water drunk in a day, in ml. */
export interface WaterEntry {
  date: DayKey;
  ml: number;
}

export interface ProgressItem {
  id?: number;
  date: DayKey;
  kind: 'photo' | 'video';
  path: string;
  /** Still frame for a video, so the grid never has to load the video itself. */
  thumb?: string;
  note?: string;
  createdAt: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

/** Everything lives in the phone's own storage — there is no server. */
export class FitWalletDb extends Dexie {
  meals!: EntityTable<Meal, 'id'>;
  weights!: EntityTable<WeightEntry, 'date'>;
  steps!: EntityTable<StepEntry, 'date'>;
  workouts!: EntityTable<Workout, 'id'>;
  habits!: EntityTable<Habit, 'id'>;
  habitChecks!: EntityTable<HabitCheck, 'id'>;
  expenses!: EntityTable<Expense, 'id'>;
  progress!: EntityTable<ProgressItem, 'id'>;
  water!: EntityTable<WaterEntry, 'date'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor(name = 'fitwallet') {
    super(name);
    this.version(1).stores({
      meals: '++id, date',
      weights: 'date',
      steps: 'date',
      workouts: '++id, date',
      habits: '++id, order',
      habitChecks: '++id, &[habitId+date], date, habitId',
      expenses: '++id, date',
      progress: '++id, date',
      settings: 'key',
    });
    this.version(2).stores({ water: 'date' });
  }
}

export const db = new FitWalletDb(DB_NAME);
