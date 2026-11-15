import type { Diet } from './db';

/** One serving of a common food. Values are typical home-style estimates, not lab figures. */
export interface Food {
  name: string;
  serving: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  diet: Diet;
  group: string;
  /** Other names people type: "chapati" finds Roti. */
  aka?: string;
}

const f = (
  name: string, serving: string, kcal: number, protein: number, carbs: number, fat: number,
  diet: Diet, group: string, aka?: string,
): Food => ({ name, serving, kcal, protein, carbs, fat, diet, group, aka });

const BREADS = 'Breads & rice';
const CURRY = 'Dal & curries';
const PROTEIN = 'Eggs, dairy & protein';
const BREAKFAST = 'Breakfast';
const SNACKS = 'Snacks & street food';
const FAST = 'Fast food';
const SWEETS = 'Sweets';
const DRINKS = 'Drinks';
const FRUITS = 'Fruits & salad';
const BASICS = 'Add-ons';

export const FOODS: Food[] = [
  f('Roti / Chapati', '1 medium', 105, 3.1, 18, 2.4, 'vegan', BREADS, 'chapati phulka rotli'),
  f('Phulka (no oil)', '1 small', 85, 3, 17, 0.5, 'vegan', BREADS),
  f('Plain paratha', '1', 230, 4.5, 30, 10, 'veg', BREADS, 'parantha'),
  f('Aloo paratha', '1', 290, 6, 40, 12, 'veg', BREADS, 'parantha potato'),
  f('Paneer paratha', '1', 330, 12, 34, 16, 'veg', BREADS, 'parantha'),
  f('Naan', '1', 260, 8, 45, 5, 'veg', BREADS),
  f('Butter naan', '1', 320, 8, 46, 11, 'veg', BREADS),
  f('Puri', '1', 100, 1.6, 10, 6, 'vegan', BREADS, 'poori'),
  f('Bhatura', '1', 300, 6, 40, 13, 'veg', BREADS),
  f('Thepla', '1', 120, 3, 16, 5, 'veg', BREADS),
  f('White bread', '1 slice', 70, 2.3, 13, 1, 'vegan', BREADS, 'toast'),
  f('Brown bread', '1 slice', 65, 3, 11, 1, 'vegan', BREADS, 'toast wheat'),
  f('Rice (cooked)', '1 katori · 150 g', 195, 4, 42, 0.4, 'vegan', BREADS, 'chawal bhaat steamed'),
  f('Brown rice (cooked)', '1 katori · 150 g', 165, 3.8, 34, 1.3, 'vegan', BREADS, 'chawal'),
  f('Jeera rice', '1 katori · 150 g', 230, 4, 42, 5, 'veg', BREADS, 'chawal'),
  f('Veg pulao', '1 plate · 200 g', 300, 6, 50, 8, 'veg', BREADS, 'pulav'),
  f('Veg biryani', '1 plate · 250 g', 400, 9, 60, 13, 'veg', BREADS),
  f('Chicken biryani', '1 plate · 300 g', 550, 28, 62, 20, 'nonveg', BREADS),
  f('Khichdi', '1 bowl · 250 g', 300, 11, 50, 6, 'veg', BREADS, 'khichri'),
  f('Curd rice', '1 bowl · 250 g', 280, 8, 45, 7, 'veg', BREADS, 'dahi chawal'),
  f('Lemon rice', '1 plate · 200 g', 280, 5, 48, 8, 'vegan', BREADS),

  f('Dal (toor / moong)', '1 katori · 150 g', 150, 9, 20, 4, 'vegan', CURRY, 'daal lentils'),
  f('Dal tadka', '1 katori · 150 g', 180, 9, 20, 7, 'veg', CURRY, 'daal fry'),
  f('Dal makhani', '1 katori · 150 g', 280, 10, 25, 16, 'veg', CURRY, 'daal'),
  f('Rajma', '1 katori · 150 g', 200, 10, 28, 6, 'vegan', CURRY, 'kidney beans'),
  f('Chole', '1 katori · 150 g', 240, 11, 32, 8, 'vegan', CURRY, 'chana masala chickpea'),
  f('Kadhi', '1 katori · 150 g', 150, 5, 12, 9, 'veg', CURRY, 'kadi'),
  f('Sambar', '1 katori · 150 g', 130, 6, 18, 4, 'vegan', CURRY),
  f('Paneer butter masala', '1 katori · 150 g', 350, 14, 12, 28, 'veg', CURRY, 'shahi paneer'),
  f('Palak paneer', '1 katori · 150 g', 260, 13, 10, 19, 'veg', CURRY, 'saag'),
  f('Matar paneer', '1 katori · 150 g', 280, 13, 15, 19, 'veg', CURRY, 'mutter'),
  f('Paneer bhurji', '1 katori · 150 g', 300, 18, 8, 22, 'veg', CURRY),
  f('Aloo sabzi', '1 katori · 150 g', 180, 3, 25, 8, 'vegan', CURRY, 'potato sabji'),
  f('Mixed veg sabzi', '1 katori · 150 g', 140, 4, 15, 7, 'vegan', CURRY, 'sabji vegetable'),
  f('Bhindi sabzi', '1 katori · 150 g', 140, 3, 12, 9, 'vegan', CURRY, 'okra ladyfinger sabji'),
  f('Aloo gobi', '1 katori · 150 g', 160, 4, 18, 8, 'vegan', CURRY, 'cauliflower sabji'),
  f('Baingan bharta', '1 katori · 150 g', 140, 3, 12, 9, 'vegan', CURRY, 'brinjal eggplant'),
  f('Soya chunks curry', '1 katori · 150 g', 220, 22, 15, 8, 'vegan', CURRY, 'nutrela'),
  f('Chicken curry', '1 katori · 150 g', 280, 25, 8, 16, 'nonveg', CURRY),
  f('Butter chicken', '1 katori · 150 g', 380, 26, 10, 26, 'nonveg', CURRY, 'murgh makhani'),
  f('Chicken tikka', '6 pieces · 150 g', 260, 38, 5, 9, 'nonveg', CURRY),
  f('Tandoori chicken', '2 pieces · 200 g', 330, 45, 5, 14, 'nonveg', CURRY),
  f('Grilled chicken breast', '150 g', 250, 46, 0, 6, 'nonveg', CURRY),
  f('Fish curry', '1 katori · 150 g', 240, 22, 6, 14, 'nonveg', CURRY),
  f('Fish fry', '1 piece · 100 g', 220, 20, 8, 12, 'nonveg', CURRY),
  f('Mutton curry', '1 katori · 150 g', 340, 26, 6, 23, 'nonveg', CURRY, 'goat lamb gosht'),
  f('Egg curry', '2 eggs + gravy', 280, 14, 8, 21, 'egg', CURRY, 'anda'),

  f('Boiled egg', '1 egg', 78, 6.3, 0.6, 5.3, 'egg', PROTEIN, 'anda'),
  f('Egg white', '1 egg', 17, 3.6, 0.2, 0, 'egg', PROTEIN),
  f('Omelette', '2 eggs', 200, 13, 2, 15, 'egg', PROTEIN, 'omlet anda'),
  f('Egg bhurji', '2 eggs', 220, 13, 4, 17, 'egg', PROTEIN, 'scrambled anda'),
  f('Paneer', '100 g', 265, 18, 3.5, 20, 'veg', PROTEIN, 'cottage cheese'),
  f('Tofu', '100 g', 145, 15, 3, 8.5, 'vegan', PROTEIN),
  f('Curd / Dahi', '1 katori · 150 g', 90, 5, 7, 5, 'veg', PROTEIN, 'yogurt'),
  f('Greek yogurt / hung curd', '150 g', 130, 15, 6, 5, 'veg', PROTEIN),
  f('Milk (toned)', '1 glass · 250 ml', 150, 8, 12, 7.5, 'veg', PROTEIN, 'doodh'),
  f('Whey protein', '1 scoop · 30 g', 120, 24, 3, 1.5, 'veg', PROTEIN, 'shake'),
  f('Soya chunks (dry)', '30 g', 105, 15, 10, 0.2, 'vegan', PROTEIN, 'nutrela'),
  f('Sprouts salad', '1 bowl', 150, 9, 22, 3, 'vegan', PROTEIN, 'moong'),
  f('Peanuts (roasted)', '30 g', 170, 7.5, 5, 14, 'vegan', PROTEIN, 'groundnut moongphali'),
  f('Almonds', '10 pieces', 70, 2.5, 2.5, 6, 'vegan', PROTEIN, 'badam'),
  f('Cashews', '10 pieces', 85, 2.7, 4.5, 6.6, 'vegan', PROTEIN, 'kaju'),
  f('Peanut butter', '1 tbsp', 95, 4, 3, 8, 'vegan', PROTEIN),
  f('Roasted chana', '30 g', 110, 6, 18, 2, 'vegan', PROTEIN, 'chickpea'),
  f('Makhana (roasted)', '1 cup · 25 g', 95, 2.5, 19, 0.5, 'vegan', PROTEIN, 'fox nuts lotus seeds'),

  f('Poha', '1 plate · 200 g', 270, 5, 45, 8, 'vegan', BREAKFAST),
  f('Upma', '1 plate · 200 g', 250, 6, 38, 8, 'veg', BREAKFAST),
  f('Idli', '1 piece', 40, 1.5, 8, 0.2, 'vegan', BREAKFAST),
  f('Plain dosa', '1', 170, 4, 28, 5, 'vegan', BREAKFAST),
  f('Masala dosa', '1', 350, 7, 50, 13, 'veg', BREAKFAST),
  f('Medu vada', '1', 140, 4, 14, 8, 'vegan', BREAKFAST, 'vadai'),
  f('Uttapam', '1', 220, 6, 35, 6, 'vegan', BREAKFAST),
  f('Besan chilla', '1', 150, 7, 18, 5, 'vegan', BREAKFAST, 'cheela'),
  f('Moong dal chilla', '1', 130, 7, 16, 4, 'vegan', BREAKFAST, 'cheela'),
  f('Oats with milk', '1 bowl', 250, 10, 38, 7, 'veg', BREAKFAST, 'porridge'),
  f('Masala oats', '1 bowl', 200, 7, 32, 5, 'vegan', BREAKFAST),
  f('Cornflakes with milk', '1 bowl', 230, 8, 42, 4, 'veg', BREAKFAST, 'cereal'),
  f('Muesli with milk', '1 bowl', 300, 10, 50, 7, 'veg', BREAKFAST, 'cereal'),
  f('Bread butter', '2 slices', 210, 5, 26, 9, 'veg', BREAKFAST, 'toast'),
  f('Veg sandwich', '1', 250, 7, 35, 9, 'veg', BREAKFAST),
  f('Paneer sandwich', '1', 330, 15, 33, 15, 'veg', BREAKFAST),
  f('Sabudana khichdi', '1 plate', 350, 3, 60, 12, 'vegan', BREAKFAST),
  f('Dhokla', '2 pieces', 160, 6, 22, 5, 'veg', BREAKFAST, 'khaman'),

  f('Samosa', '1', 260, 4, 30, 14, 'vegan', SNACKS),
  f('Kachori', '1', 190, 4, 20, 11, 'vegan', SNACKS),
  f('Pakora / Bhajiya', '5 pieces', 250, 6, 22, 15, 'vegan', SNACKS, 'pakoda bhaji'),
  f('Pav bhaji', '1 plate · 2 pav', 450, 11, 60, 18, 'veg', SNACKS),
  f('Vada pav', '1', 290, 6, 40, 12, 'vegan', SNACKS),
  f('Pani puri', '6 pieces', 220, 4, 34, 7, 'vegan', SNACKS, 'golgappa puchka'),
  f('Bhel puri', '1 plate', 250, 6, 40, 7, 'vegan', SNACKS),
  f('Maggi noodles', '1 packet', 310, 7, 45, 12, 'veg', SNACKS, 'instant noodles'),
  f('Chips', '1 small pack · 30 g', 160, 2, 15, 10, 'vegan', SNACKS, 'wafers lays'),
  f('Marie biscuits', '4 biscuits', 120, 2, 20, 3.5, 'veg', SNACKS, 'cookies'),
  f('Namkeen / Bhujia', '30 g', 160, 4, 13, 10, 'vegan', SNACKS, 'mixture'),
  f('Popcorn', '1 bowl · 25 g', 120, 3, 18, 4.5, 'vegan', SNACKS),

  f('Pizza', '1 slice', 280, 12, 33, 11, 'veg', FAST),
  f('Veg burger', '1', 380, 10, 48, 16, 'veg', FAST),
  f('Chicken burger', '1', 450, 22, 45, 20, 'nonveg', FAST),
  f('French fries', '1 medium', 350, 4, 45, 17, 'vegan', FAST, 'chips'),
  f('Veg momos (steamed)', '6 pieces', 240, 7, 40, 5, 'vegan', FAST, 'dumplings'),
  f('Chicken momos (steamed)', '6 pieces', 300, 16, 34, 10, 'nonveg', FAST, 'dumplings'),
  f('Veg fried rice', '1 plate', 400, 8, 65, 12, 'vegan', FAST, 'chinese'),
  f('Hakka noodles', '1 plate', 420, 9, 62, 15, 'vegan', FAST, 'chowmein chinese'),
  f('White sauce pasta', '1 plate', 500, 15, 60, 22, 'veg', FAST),
  f('Chicken shawarma', '1 roll', 450, 25, 40, 20, 'nonveg', FAST),
  f('Paneer kathi roll', '1', 420, 15, 45, 20, 'veg', FAST, 'frankie wrap'),

  f('Gulab jamun', '1 piece', 150, 2, 22, 6, 'veg', SWEETS),
  f('Rasgulla', '1 piece', 125, 2.5, 26, 1.5, 'veg', SWEETS),
  f('Jalebi', '2 pieces', 300, 2, 45, 12, 'veg', SWEETS),
  f('Kheer', '1 katori', 250, 7, 35, 9, 'veg', SWEETS, 'payasam'),
  f('Besan ladoo', '1', 180, 3, 20, 10, 'veg', SWEETS, 'laddu'),
  f('Sooji halwa', '1 katori', 330, 4, 45, 15, 'veg', SWEETS, 'sheera'),
  f('Ice cream', '1 scoop', 140, 2.5, 17, 7, 'veg', SWEETS),
  f('Dark chocolate', '2 squares · 20 g', 115, 1.5, 9, 8, 'vegan', SWEETS),

  f('Tea with milk & sugar', '1 cup', 70, 2, 10, 2, 'veg', DRINKS, 'chai'),
  f('Coffee with milk & sugar', '1 cup', 80, 2.5, 11, 2.5, 'veg', DRINKS),
  f('Black coffee', '1 cup', 5, 0.3, 0, 0, 'vegan', DRINKS),
  f('Green tea', '1 cup', 2, 0, 0, 0, 'vegan', DRINKS),
  f('Buttermilk / Chaas', '1 glass', 40, 2, 5, 1, 'veg', DRINKS, 'mattha'),
  f('Sweet lassi', '1 glass', 220, 7, 35, 6, 'veg', DRINKS),
  f('Banana shake', '1 glass', 250, 8, 40, 6, 'veg', DRINKS, 'milkshake'),
  f('Fresh fruit juice', '1 glass', 120, 1, 28, 0.3, 'vegan', DRINKS),
  f('Coconut water', '1 glass', 45, 1.7, 9, 0.5, 'vegan', DRINKS, 'nariyal pani'),
  f('Cola / soft drink', '1 can · 330 ml', 140, 0, 35, 0, 'vegan', DRINKS, 'coke pepsi'),
  f('Beer', '1 bottle · 330 ml', 150, 1.6, 13, 0, 'vegan', DRINKS),

  f('Banana', '1 medium', 105, 1.3, 27, 0.4, 'vegan', FRUITS, 'kela'),
  f('Apple', '1 medium', 95, 0.5, 25, 0.3, 'vegan', FRUITS, 'seb'),
  f('Orange', '1', 62, 1.2, 15, 0.2, 'vegan', FRUITS, 'santra'),
  f('Mango', '1 cup · 165 g', 100, 1.4, 25, 0.6, 'vegan', FRUITS, 'aam'),
  f('Papaya', '1 bowl · 150 g', 65, 0.7, 16, 0.4, 'vegan', FRUITS, 'papita'),
  f('Watermelon', '1 bowl · 150 g', 45, 0.9, 11, 0.2, 'vegan', FRUITS, 'tarbooz'),
  f('Grapes', '1 cup · 150 g', 100, 1, 27, 0.2, 'vegan', FRUITS, 'angoor'),
  f('Guava', '1 medium', 40, 1.4, 8, 0.5, 'vegan', FRUITS, 'amrood'),
  f('Pomegranate', '1 cup', 145, 3, 33, 2, 'vegan', FRUITS, 'anar'),
  f('Dates (khajur)', '3 small', 70, 0.6, 18, 0, 'vegan', FRUITS),
  f('Green salad', '1 bowl', 40, 1.5, 8, 0.3, 'vegan', FRUITS, 'cucumber tomato onion kachumber'),

  f('Ghee', '1 tsp', 45, 0, 0, 5, 'veg', BASICS),
  f('Butter', '1 tsp', 36, 0, 0, 4, 'veg', BASICS),
  f('Cooking oil', '1 tsp', 40, 0, 0, 4.5, 'vegan', BASICS),
  f('Sugar', '1 tsp', 16, 0, 4, 0, 'vegan', BASICS, 'cheeni'),
  f('Pickle (achar)', '1 tbsp', 30, 0, 2, 2.5, 'vegan', BASICS),
  f('Papad (roasted)', '1', 35, 2.5, 6, 0.2, 'vegan', BASICS, 'papadum'),
  f('Raita', '1 katori', 80, 4, 7, 4, 'veg', BASICS),
  f('Green chutney', '1 tbsp', 10, 0.3, 1.5, 0.3, 'vegan', BASICS, 'mint'),
];

/** Matches every word typed, in the name or another name: "aloo par" finds Aloo paratha. */
export function searchFoods(query: string, foods: Food[] = FOODS): Food[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return foods;
  return foods.filter((food) => {
    const hay = `${food.name} ${food.aka ?? ''}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
