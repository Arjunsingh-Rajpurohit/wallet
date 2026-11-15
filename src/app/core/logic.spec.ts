import { fitsDiet, workoutKcal } from './catalog';
import { addDays, daysBetween, mealTypeNow, monthRange } from './dates';
import { searchFoods } from './food-db';
import { suggestMeals } from './meal-ideas';
import { DEFAULT_PROFILE, bmi, goalsFor, suggestedCalories, suggestedProtein, type Profile } from './profile';
import { toSeries } from './series';

const arjun: Profile = { ...DEFAULT_PROFILE, sex: 'male', birthYear: 1996, heightCm: 175, activity: 'light', goal: 'lose' };

describe('goals', () => {
  it('works out calories with Mifflin-St Jeor: 30 y man, 175 cm, 80 kg, light, losing → 1,900', () => {
    expect(suggestedCalories(arjun, 80, 2026)).toBe(1900);
  });

  it('never suggests a crash diet', () => {
    const small: Profile = { ...arjun, sex: 'female', heightCm: 150, activity: 'sedentary' };
    expect(suggestedCalories(small, 45, 2026)).toBe(1200);
  });

  it('protein: 1.6 g/kg while changing weight, 1.2 g/kg to stay the same', () => {
    expect(suggestedProtein(arjun, 80)).toBe(128);
    expect(suggestedProtein({ ...arjun, goal: 'maintain' }, 80)).toBe(96);
  });

  it('falls back to typed goals until the profile is complete', () => {
    expect(goalsFor({ ...DEFAULT_PROFILE, calorieGoal: 2200 }, null).kcal).toBe(2200);
    expect(goalsFor({ ...arjun, autoGoals: false, calorieGoal: 2500 }, 80).kcal).toBe(2500);
  });

  it('BMI 80 kg at 175 cm is 26.1', () => {
    expect(bmi(175, 80)).toBe(26.1);
  });
});

describe('meal ideas', () => {
  it('a vegetarian never gets chicken or eggs', () => {
    const r = suggestMeals(700, 40, 'veg', 'dinner');
    expect(r.ideas.length).toBe(3);
    for (const i of r.ideas) expect(['vegan', 'veg']).toContain(i.diet);
  });

  it('leads with protein when protein is short', () => {
    const r = suggestMeals(650, 40, 'veg', 'dinner');
    expect(r.ideas[0].protein).toBeGreaterThanOrEqual(19);
  });

  it('keeps it light once the calorie goal is hit', () => {
    const r = suggestMeals(50, 10, 'nonveg', 'snack');
    for (const i of r.ideas) expect(i.kcal).toBeLessThanOrEqual(160);
    expect(r.headline).toContain('hit');
  });

  it('diet ranks: vegan ⊂ veg ⊂ egg ⊂ non-veg', () => {
    expect(fitsDiet('vegan', 'veg')).toBe(true);
    expect(fitsDiet('egg', 'veg')).toBe(false);
    expect(fitsDiet('nonveg', 'nonveg')).toBe(true);
  });
});

describe('food search', () => {
  it('finds by any word and by other names', () => {
    expect(searchFoods('chapati').map((f) => f.name)).toContain('Roti / Chapati');
    expect(searchFoods('aloo par').map((f) => f.name)).toEqual(['Aloo paratha']);
    expect(searchFoods('xyz123')).toEqual([]);
  });
});

describe('workouts', () => {
  it('30 min run at 70 kg burns about 343 kcal', () => {
    expect(workoutKcal('run', 30, 70)).toBe(343);
  });
});

describe('dates and chart buckets', () => {
  it('walks days across month ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(daysBetween('2026-02-27', '2026-03-01')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('picks the meal by time of day', () => {
    expect(mealTypeNow(new Date(2026, 9, 18, 8))).toBe('breakfast');
    expect(mealTypeNow(new Date(2026, 9, 18, 13))).toBe('lunch');
    expect(mealTypeNow(new Date(2026, 9, 18, 17))).toBe('snack');
    expect(mealTypeNow(new Date(2026, 9, 18, 21))).toBe('dinner');
  });

  it('daily bars up to a month, weekly averages for three months', () => {
    const steps = new Map([['2026-10-18', 7000], ['2026-10-17', 9000]]);
    const week = toSeries('2026-10-12', '2026-10-18', steps, 'avg');
    expect(week.values).toEqual([0, 0, 0, 0, 0, 9000, 7000]);

    const quarter = toSeries(addDays('2026-10-18', -89), '2026-10-18', steps, 'avg');
    expect(quarter.values.length).toBe(13);
    expect(quarter.unit).toContain('week');
  });
});
