import type { Diet } from './db';

export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very';
export type Goal = 'lose' | 'maintain' | 'gain';

export interface Profile {
  name: string;
  sex: Sex | null;
  birthYear: number | null;
  heightCm: number | null;
  goalWeightKg: number | null;
  activity: Activity;
  goal: Goal;
  diet: Diet;
  /** When on, calorie and protein goals follow body, activity and goal. */
  autoGoals: boolean;
  calorieGoal: number;
  proteinGoal: number;
  stepGoal: number;
  /** Glasses of water a day (one glass = 250 ml). */
  waterGoal: number;
  monthlyBudget: number | null;
}

export const DEFAULT_PROFILE: Profile = {
  name: '',
  sex: null,
  birthYear: null,
  heightCm: null,
  goalWeightKg: null,
  activity: 'light',
  goal: 'maintain',
  diet: 'veg',
  autoGoals: true,
  calorieGoal: 2000,
  proteinGoal: 60,
  stepGoal: 8000,
  waterGoal: 8,
  monthlyBudget: null,
};

export const ACTIVITY_LEVELS: { key: Activity; label: string; factor: number }[] = [
  { key: 'sedentary', label: 'Mostly sitting', factor: 1.2 },
  { key: 'light', label: 'Light — some walking', factor: 1.375 },
  { key: 'moderate', label: 'Exercise 3–5 days a week', factor: 1.55 },
  { key: 'active', label: 'Exercise 6–7 days a week', factor: 1.725 },
  { key: 'very', label: 'Hard training or physical job', factor: 1.9 },
];

export const GOALS: { key: Goal; label: string; shift: number }[] = [
  { key: 'lose', label: 'Lose weight', shift: -500 },
  { key: 'maintain', label: 'Stay the same', shift: 0 },
  { key: 'gain', label: 'Gain muscle / weight', shift: 300 },
];

export const DIETS: { key: Diet; label: string }[] = [
  { key: 'veg', label: 'Vegetarian' },
  { key: 'egg', label: 'Eggetarian' },
  { key: 'nonveg', label: 'Non-veg' },
  { key: 'vegan', label: 'Vegan' },
];

/** One glass of water. */
export const GLASS_ML = 250;

export interface Goals {
  kcal: number;
  protein: number;
  steps: number;
  /** Glasses of water a day. */
  water: number;
  budget: number | null;
  goalWeightKg: number | null;
}

/**
 * Daily calories from the Mifflin-St Jeor formula × activity, shifted for the goal.
 * Example: man, 30, 175 cm, 80 kg, light, lose → 1,749 × 1.375 − 500 ≈ 1,900 kcal.
 * Null until the profile has what the formula needs.
 */
export function suggestedCalories(p: Profile, weightKg: number | null, year = new Date().getFullYear()): number | null {
  if (!p.sex || !p.birthYear || !p.heightCm || !weightKg) return null;
  const age = year - p.birthYear;
  const bmr = 10 * weightKg + 6.25 * p.heightCm - 5 * age + (p.sex === 'male' ? 5 : -161);
  const factor = ACTIVITY_LEVELS.find((a) => a.key === p.activity)?.factor ?? 1.375;
  const shift = GOALS.find((g) => g.key === p.goal)?.shift ?? 0;
  // Never suggest a crash diet, whatever the numbers say.
  const floor = p.sex === 'male' ? 1500 : 1200;
  return Math.max(floor, Math.round((bmr * factor + shift) / 50) * 50);
}

/** 1.6 g per kg while changing weight (keeps muscle), 1.2 g per kg to stay the same. */
export function suggestedProtein(p: Profile, weightKg: number | null): number | null {
  if (!weightKg) return null;
  return Math.round(weightKg * (p.goal === 'maintain' ? 1.2 : 1.6));
}

export function goalsFor(p: Profile, weightKg: number | null, year = new Date().getFullYear()): Goals {
  const autoKcal = p.autoGoals ? suggestedCalories(p, weightKg, year) : null;
  const autoProtein = p.autoGoals ? suggestedProtein(p, weightKg) : null;
  return {
    kcal: autoKcal ?? p.calorieGoal,
    protein: autoProtein ?? p.proteinGoal,
    steps: p.stepGoal,
    water: p.waterGoal || 8,
    budget: p.monthlyBudget,
    goalWeightKg: p.goalWeightKg,
  };
}

export function bmi(heightCm: number | null, weightKg: number | null): number | null {
  if (!heightCm || !weightKg) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}
