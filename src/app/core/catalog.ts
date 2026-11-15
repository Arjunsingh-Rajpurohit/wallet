import type { Diet, ExpenseCategory, MealType, PaymentMethod, WorkoutType } from './db';

export const MEAL_TYPES: { key: MealType; label: string; emoji: string }[] = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { key: 'lunch', label: 'Lunch', emoji: '☀️' },
  { key: 'snack', label: 'Snacks', emoji: '🍎' },
  { key: 'dinner', label: 'Dinner', emoji: '🌙' },
];

/** MET values from the Compendium of Physical Activities (typical intensity). */
export const WORKOUT_TYPES: { key: WorkoutType; label: string; emoji: string; met: number }[] = [
  { key: 'walk', label: 'Walk', emoji: '🚶', met: 3.5 },
  { key: 'run', label: 'Run', emoji: '🏃', met: 9.8 },
  { key: 'gym', label: 'Gym', emoji: '🏋️', met: 5.0 },
  { key: 'yoga', label: 'Yoga', emoji: '🧘', met: 2.5 },
  { key: 'cycling', label: 'Cycling', emoji: '🚴', met: 7.5 },
  { key: 'swim', label: 'Swim', emoji: '🏊', met: 7.0 },
  { key: 'sports', label: 'Sports', emoji: '🏸', met: 7.0 },
  { key: 'hiit', label: 'HIIT', emoji: '🔥', met: 8.0 },
  { key: 'other', label: 'Other', emoji: '💪', met: 4.0 },
];

/** kcal = MET × body weight (kg) × hours. Example: 30 min run at 70 kg → 9.8 × 70 × 0.5 ≈ 343. */
export function workoutKcal(type: WorkoutType, minutes: number, weightKg: number | null): number {
  const met = WORKOUT_TYPES.find((w) => w.key === type)?.met ?? 4;
  return Math.round(met * (weightKg || 70) * (minutes / 60));
}

export const CATEGORIES: { key: ExpenseCategory; label: string; emoji: string }[] = [
  { key: 'food', label: 'Food & dining', emoji: '🍔' },
  { key: 'groceries', label: 'Groceries', emoji: '🛒' },
  { key: 'transport', label: 'Transport', emoji: '🚕' },
  { key: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { key: 'bills', label: 'Bills & recharge', emoji: '💡' },
  { key: 'health', label: 'Health', emoji: '💊' },
  { key: 'fitness', label: 'Fitness', emoji: '🏋️' },
  { key: 'fun', label: 'Fun & movies', emoji: '🎬' },
  { key: 'rent', label: 'Rent', emoji: '🏠' },
  { key: 'education', label: 'Education', emoji: '📚' },
  { key: 'travel', label: 'Travel', emoji: '✈️' },
  { key: 'other', label: 'Other', emoji: '📦' },
];

export const INCOME_CATEGORIES: { key: ExpenseCategory; label: string; emoji: string }[] = [
  { key: 'salary', label: 'Salary', emoji: '💼' },
  { key: 'business', label: 'Business', emoji: '🏪' },
  { key: 'gift', label: 'Gift', emoji: '🎁' },
  { key: 'refund', label: 'Refund', emoji: '↩️' },
  { key: 'interest', label: 'Interest', emoji: '🏦' },
  { key: 'other', label: 'Other', emoji: '💰' },
];

export const PAYMENTS: { key: PaymentMethod; label: string }[] = [
  { key: 'upi', label: 'UPI' },
  { key: 'cash', label: 'Cash' },
  { key: 'card', label: 'Card' },
  { key: 'other', label: 'Other' },
];

export const HABIT_IDEAS: { name: string; emoji: string }[] = [
  { name: 'Drink 3 L water', emoji: '💧' },
  { name: 'Workout', emoji: '🏋️' },
  { name: '10k steps', emoji: '🚶' },
  { name: 'Sleep 7+ hours', emoji: '😴' },
  { name: 'No junk food', emoji: '🥗' },
  { name: 'Read 10 minutes', emoji: '📖' },
  { name: 'Meditate', emoji: '🧘' },
  { name: 'No sugar', emoji: '🚫' },
];

const DIET_RANK: Record<Diet, number> = { vegan: 0, veg: 1, egg: 2, nonveg: 3 };

/** A vegetarian sees vegan and veg food; a non-veg eater sees everything. */
export function fitsDiet(food: Diet, person: Diet): boolean {
  return DIET_RANK[food] <= DIET_RANK[person];
}

export const categoryOf = (key: ExpenseCategory, moneyIn = false) =>
  (moneyIn ? INCOME_CATEGORIES : CATEGORIES).find((c) => c.key === key)
  ?? INCOME_CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1];
export const workoutOf = (key: WorkoutType) => WORKOUT_TYPES.find((w) => w.key === key) ?? WORKOUT_TYPES[WORKOUT_TYPES.length - 1];
