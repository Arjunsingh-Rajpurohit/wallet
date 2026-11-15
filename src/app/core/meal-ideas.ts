import { fitsDiet } from './catalog';
import type { Diet, MealType } from './db';

export interface MealIdea {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  diet: Diet;
  slots: MealType[];
}

const idea = (name: string, kcal: number, protein: number, carbs: number, fat: number, diet: Diet, ...slots: MealType[]): MealIdea =>
  ({ name, kcal, protein, carbs, fat, diet, slots });

/** Ready-made Indian meals with their totals, built from the food list's servings. */
export const MEAL_IDEAS: MealIdea[] = [
  idea('Moong dal chilla (2) + curd', 350, 19, 39, 13, 'veg', 'breakfast', 'dinner'),
  idea('Besan chilla (2) + green chutney', 310, 14, 37, 10, 'vegan', 'breakfast'),
  idea('Poha + buttermilk', 310, 7, 50, 9, 'veg', 'breakfast'),
  idea('Upma + 1 boiled egg', 330, 12, 39, 13, 'egg', 'breakfast'),
  idea('3 idli + sambar', 250, 10.5, 42, 4.6, 'vegan', 'breakfast', 'dinner'),
  idea('Oats with milk + banana', 355, 11, 65, 7, 'veg', 'breakfast'),
  idea('Paneer sandwich', 330, 15, 33, 15, 'veg', 'breakfast', 'snack'),
  idea('2-egg omelette + 2 brown bread', 330, 19, 24, 17, 'egg', 'breakfast', 'dinner'),
  idea('Peanut butter toast + glass of milk', 385, 16.6, 41, 17.5, 'veg', 'breakfast'),
  idea('Hung curd bowl with fruit & nuts', 280, 18, 30, 10, 'veg', 'breakfast', 'snack'),
  idea('Masala oats + 2 boiled eggs', 356, 19.6, 33, 15.6, 'egg', 'breakfast'),
  idea('Tofu bhurji + 2 roti', 360, 21, 40, 13, 'vegan', 'breakfast', 'dinner'),

  idea('Dal + 2 roti + mixed veg + salad', 545, 18.7, 79, 16, 'vegan', 'lunch', 'dinner'),
  idea('Rajma chawal + salad', 435, 15.5, 78, 6.7, 'vegan', 'lunch'),
  idea('Chole + 2 roti + salad', 490, 18.7, 76, 13, 'vegan', 'lunch', 'dinner'),
  idea('Paneer bhurji + 2 roti', 510, 24, 44, 27, 'veg', 'lunch', 'dinner'),
  idea('Palak paneer + 2 roti', 470, 19, 46, 24, 'veg', 'lunch', 'dinner'),
  idea('Soya chunks curry + 1 roti + curd', 415, 30, 40, 14, 'veg', 'lunch', 'dinner'),
  idea('Khichdi + curd', 390, 16, 57, 11, 'veg', 'lunch', 'dinner'),
  idea('Curd rice + salad', 320, 9.5, 53, 7.3, 'veg', 'lunch'),
  idea('Sambar rice + papad', 360, 12.5, 66, 4.6, 'vegan', 'lunch'),
  idea('Dal tadka + jeera rice', 410, 13, 62, 12, 'veg', 'lunch'),
  idea('Veg pulao + raita', 380, 10, 57, 12, 'veg', 'lunch', 'dinner'),
  idea('Grilled chicken + salad + 1 roti', 395, 50.6, 26, 9, 'nonveg', 'lunch', 'dinner'),
  idea('Chicken curry + 2 roti', 490, 31, 44, 21, 'nonveg', 'lunch', 'dinner'),
  idea('Chicken curry + 1 katori rice', 475, 29, 50, 16.4, 'nonveg', 'lunch'),
  idea('Fish curry + 1 katori rice', 435, 26, 48, 14.4, 'nonveg', 'lunch', 'dinner'),
  idea('Egg curry + 2 roti', 490, 20, 44, 26, 'egg', 'lunch', 'dinner'),
  idea('Tandoori chicken (2 pcs) + salad', 370, 46.5, 13, 14.3, 'nonveg', 'dinner'),
  idea('Paneer tikka + salad', 380, 25, 14, 25, 'veg', 'dinner', 'snack'),
  idea('Moong dal khichdi + buttermilk', 340, 13, 55, 7, 'veg', 'dinner'),

  idea('Roasted chana (30 g)', 110, 6, 18, 2, 'vegan', 'snack'),
  idea('Sprouts salad', 150, 9, 22, 3, 'vegan', 'snack', 'breakfast'),
  idea('Banana + 10 almonds', 175, 3.8, 29.5, 6.4, 'vegan', 'snack'),
  idea('Whey shake with water', 120, 24, 3, 1.5, 'veg', 'snack'),
  idea('Buttermilk + roasted makhana', 135, 4.5, 24, 1.5, 'veg', 'snack'),
  idea('2 boiled eggs', 156, 12.6, 1.2, 10.6, 'egg', 'snack'),
  idea('Fruit bowl (papaya + apple)', 160, 1.2, 41, 0.7, 'vegan', 'snack'),
  idea('Dhokla (2) + green chutney', 170, 6.3, 23.5, 5.3, 'veg', 'snack', 'breakfast'),
  idea('Green salad + 1 boiled egg', 118, 7.8, 8.6, 5.6, 'egg', 'snack', 'dinner'),
  idea('Coconut water', 45, 1.7, 9, 0.5, 'vegan', 'snack'),
  idea('Green tea', 2, 0, 0, 0, 'vegan', 'snack'),
];

export interface Suggestion extends MealIdea {
  why: string;
}

export interface SuggestionResult {
  remainingKcal: number;
  remainingProtein: number;
  headline: string;
  ideas: Suggestion[];
}

/** Share of what is left that the next meal should take — dinner closes the day. */
const NEXT_MEAL_SHARE: Record<MealType, number> = { breakfast: 0.3, lunch: 0.5, snack: 0.2, dinner: 1 };

/**
 * Three meals that fit what is left today, best protein first when protein is short.
 * Example: 650 kcal and 40 g protein left at dinner, vegetarian →
 * Soya chunks curry + 1 roti + curd (30 g protein) leads.
 */
export function suggestMeals(remainingKcal: number, remainingProtein: number, diet: Diet, slot: MealType, ideas = MEAL_IDEAS): SuggestionResult {
  const kcalLeft = Math.round(remainingKcal);
  const proteinLeft = Math.max(0, Math.round(remainingProtein));
  const allowed = ideas.filter((i) => fitsDiet(i.diet, diet));

  if (kcalLeft <= 120) {
    const light = allowed.filter((i) => i.kcal <= 160).sort((a, b) => a.kcal - b.kcal).slice(0, 3);
    return {
      remainingKcal: kcalLeft,
      remainingProtein: proteinLeft,
      headline: "You've hit today's calorie goal 🎉 If you're still hungry, keep it light:",
      ideas: light.map((i) => ({ ...i, why: `Only ${i.kcal} kcal` })),
    };
  }

  const target = Math.min(900, Math.max(150, kcalLeft * NEXT_MEAL_SHARE[slot]));
  const inSlot = allowed.filter((i) => i.slots.includes(slot));
  const pool = inSlot.length ? inSlot : allowed;
  const fits = pool.filter((i) => i.kcal <= target * 1.15 + 30);
  const proteinMatters = proteinLeft >= 15;

  const score = (i: MealIdea) => {
    const closeness = -Math.abs(i.kcal - target) / target;
    const protein = proteinMatters ? (Math.min(i.protein, proteinLeft) / proteinLeft) * 0.8 : 0;
    return closeness + protein;
  };
  const picked = (fits.length ? fits : [...pool].sort((a, b) => a.kcal - b.kcal).slice(0, 3))
    .sort((a, b) => score(b) - score(a))
    .slice(0, 3);

  return {
    remainingKcal: kcalLeft,
    remainingProtein: proteinLeft,
    headline: proteinMatters
      ? `${kcalLeft} kcal and ${proteinLeft} g protein left today. Protein-rich picks:`
      : `${kcalLeft} kcal left today. These fit well:`,
    ideas: picked.map((i) => ({
      ...i,
      why: proteinMatters ? `${Math.round(i.protein)} g protein · ${i.kcal} kcal` : `${i.kcal} kcal`,
    })),
  };
}
