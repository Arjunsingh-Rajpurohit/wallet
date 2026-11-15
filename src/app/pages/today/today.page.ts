import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { addIcons } from 'ionicons';
import { add, camera, checkmark, settingsOutline } from 'ionicons/icons';
import { addDays, dayKey, mealTypeNow, monthKey, parseDay } from '../../core/dates';
import { db, type StepEntry, type WeightEntry, type Workout } from '../../core/db';
import { dec1, inr, num, round1 } from '../../core/format';
import { liveBy } from '../../core/live';
import { suggestMeals } from '../../core/meal-ideas';
import { GLASS_ML } from '../../core/profile';
import { weekSummary, type WeekSummary } from '../../core/week';
import { SettingsService } from '../../core/settings.service';
import { HAS_MONEY } from '../../core/variant';
import {
  NO_TOTALS, addWater, kcalByDay, mealsOn, routineOn, routineScore, setHabitDone, spentBetween, stepsBetween, sumMeals,
  waterBetween, waterOn, weightsBetween, workoutsBetween,
  type HabitStatus, type Totals,
} from '../../core/store';
import { ActionsService } from '../../shared/actions.service';
import { RingComponent } from '../../shared/ring.component';

interface TodayData {
  food: Totals;
  steps: StepEntry | undefined;
  weights: WeightEntry[];
  workouts: Workout[];
  spentToday: number;
  spentMonth: number;
  routine: HabitStatus[];
  waterMl: number;
  week: WeekSummary;
}

const EMPTY_WEEK: WeekSummary = {
  kcalAvg: null, proteinAvg: null, kcalDays: 0, stepsAvg: null, workouts: 0, workoutMinutes: 0, waterAvgMl: null, weightChange: null, routinePct: null,
};
const EMPTY: TodayData = {
  food: NO_TOTALS, steps: undefined, weights: [], workouts: [], spentToday: 0, spentMonth: 0, routine: [], waterMl: 0, week: EMPTY_WEEK,
};

@Component({
  selector: 'fw-today',
  imports: [RouterLink, IonContent, IonButton, IonIcon, RingComponent],
  templateUrl: './today.page.html',
  styleUrl: './today.page.scss',
})
export class TodayPage {
  protected readonly settings = inject(SettingsService);
  protected readonly act = inject(ActionsService);
  protected readonly inr = inr;
  protected readonly hasMoney = HAS_MONEY;
  protected readonly num = num;
  protected readonly dec1 = dec1;

  protected readonly today = signal(dayKey());
  protected readonly data = liveBy(this.today, async (d): Promise<TodayData> => {
    const from = addDays(d, -6);
    const [meals, steps, weights, workouts, spentToday, spentMonth, routine, waterMl, food7, steps7, workouts7, water7, routine7] = await Promise.all([
      mealsOn(d), db.steps.get(d), weightsBetween(addDays(d, -60), d), workoutsBetween(d, d),
      HAS_MONEY ? spentBetween(d, d) : 0, HAS_MONEY ? spentBetween(`${monthKey(d)}-01`, d) : 0, routineOn(d), waterOn(d),
      kcalByDay(from, d), stepsBetween(from, d), workoutsBetween(from, d), waterBetween(from, d), routineScore(from, d),
    ]);
    const week = weekSummary({ from, to: d, food: food7, steps: steps7, workouts: workouts7, water: water7, weights, routine: routine7 });
    return { food: sumMeals(meals), steps, weights, workouts, spentToday, spentMonth, routine, waterMl, week };
  }, EMPTY);

  protected readonly goals = this.settings.goals;
  protected readonly dateText = computed(() =>
    parseDay(this.today()).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }));
  protected readonly greeting = computed(() => {
    const h = new Date().getHours();
    const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    const name = this.settings.profile().name.split(' ')[0];
    return name ? `${part}, ${name}` : part;
  });

  protected readonly kcalLeft = computed(() => this.goals().kcal - Math.round(this.data().food.kcal));
  protected readonly stepsToday = computed(() => this.data().steps?.steps ?? 0);
  protected readonly workoutMinutes = computed(() => this.data().workouts.reduce((s, w) => s + w.minutes, 0));
  protected readonly workoutKcal = computed(() => this.data().workouts.reduce((s, w) => s + w.kcal, 0));
  protected readonly glasses = computed(() => Math.round(this.data().waterMl / GLASS_ML));
  protected readonly drops = computed(() => {
    const goal = Math.min(16, Math.max(this.goals().water, this.glasses()));
    return Array.from({ length: goal }, (_, i) => i < this.glasses());
  });
  /** Only what was really logged this week shows; nothing logged, no card. */
  protected readonly week = computed(() => {
    const w = this.data().week;
    const goalKg = this.goals().goalWeightKg;
    const latest = this.data().weights[this.data().weights.length - 1]?.kg;
    const items: { emoji: string; value: string; label: string; good?: boolean }[] = [];
    if (w.kcalAvg !== null) items.push({ emoji: '🍽️', value: num(w.kcalAvg), label: `kcal a day (${w.kcalDays} day${w.kcalDays === 1 ? '' : 's'})` });
    if (w.proteinAvg !== null) items.push({ emoji: '💪', value: `${w.proteinAvg} g`, label: 'protein a day', good: w.proteinAvg >= this.goals().protein });
    if (w.stepsAvg !== null) items.push({ emoji: '🚶', value: num(w.stepsAvg), label: 'steps a day', good: w.stepsAvg >= this.goals().steps });
    if (w.workouts) items.push({ emoji: '🏋️', value: String(w.workouts), label: `workout${w.workouts === 1 ? '' : 's'} · ${w.workoutMinutes} min` });
    if (w.waterAvgMl !== null) items.push({ emoji: '💧', value: dec1(w.waterAvgMl / GLASS_ML), label: 'glasses a day', good: w.waterAvgMl / GLASS_ML >= this.goals().water });
    if (w.weightChange !== null) {
      const towards = goalKg && latest ? (w.weightChange < 0) === (latest > goalKg) && w.weightChange !== 0 : false;
      items.push({ emoji: '⚖️', value: `${w.weightChange > 0 ? '+' : ''}${dec1(w.weightChange)} kg`, label: 'weight', good: towards });
    }
    if (w.routinePct !== null) items.push({ emoji: '✅', value: `${w.routinePct}%`, label: 'routine done', good: w.routinePct >= 80 });
    return items;
  });
  protected readonly routineDone = computed(() => this.data().routine.filter((r) => r.done).length);

  protected readonly weight = computed(() => {
    const list = this.data().weights;
    const latest = list[list.length - 1];
    if (!latest) return null;
    // Compare with the entry closest to a week before the latest one.
    const weekAgo = addDays(latest.date, -7);
    const before = [...list].reverse().find((w) => w.date <= weekAgo) ?? list[0];
    const change = before && before.date !== latest.date ? round1(latest.kg - before.kg) : null;
    const goal = this.goals().goalWeightKg;
    const toGoal = goal ? round1(latest.kg - goal) : null;
    // Green only when the week moved you towards your goal weight.
    const towardsGoal = change === null || toGoal === null || change === 0 ? null : (change < 0) === (toGoal > 0);
    return { kg: latest.kg, change, toGoal, towardsGoal };
  });

  protected readonly nextMeal = computed(() => {
    const food = this.data().food;
    return suggestMeals(this.goals().kcal - food.kcal, this.goals().protein - food.protein, this.settings.profile().diet, mealTypeNow());
  });

  constructor() {
    addIcons({ settingsOutline, add, camera, checkmark });
  }

  /** Coming back to the app the next morning shows the new day. */
  ionViewWillEnter(): void {
    this.today.set(dayKey());
  }

  protected async tick(r: HabitStatus): Promise<void> {
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
    await setHabitDone(r.habit.id!, this.today(), !r.done);
  }

  protected async water(glasses: number): Promise<void> {
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
    await addWater(this.today(), glasses * GLASS_ML);
  }

  protected pct(value: number, max: number): number {
    return max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  }
}
