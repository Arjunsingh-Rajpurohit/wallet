import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { IonButton, IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, camera, checkmark, settingsOutline } from 'ionicons/icons';
import { addDays, dayKey, mealTypeNow, monthKey, parseDay } from '../../core/dates';
import { db, type StepEntry, type WeightEntry, type Workout } from '../../core/db';
import { dec1, inr, num, round1 } from '../../core/format';
import { liveBy } from '../../core/live';
import { suggestMeals } from '../../core/meal-ideas';
import { SettingsService } from '../../core/settings.service';
import { HAS_MONEY } from '../../core/variant';
import {
  NO_TOTALS, mealsOn, routineOn, setHabitDone, spentBetween, sumMeals, weightsBetween, workoutsBetween,
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
}

const EMPTY: TodayData = { food: NO_TOTALS, steps: undefined, weights: [], workouts: [], spentToday: 0, spentMonth: 0, routine: [] };

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
    const [meals, steps, weights, workouts, spentToday, spentMonth, routine] = await Promise.all([
      mealsOn(d), db.steps.get(d), weightsBetween(addDays(d, -60), d), workoutsBetween(d, d),
      spentBetween(d, d), spentBetween(`${monthKey(d)}-01`, d), routineOn(d),
    ]);
    return { food: sumMeals(meals), steps, weights, workouts, spentToday, spentMonth, routine };
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

  protected pct(value: number, max: number): number {
    return max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  }
}
