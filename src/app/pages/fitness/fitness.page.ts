import { Component, computed, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonItem } from '@ionic/angular/ion-item';
import { IonItemOption } from '@ionic/angular/ion-item-option';
import { IonItemOptions } from '@ionic/angular/ion-item-options';
import { IonItemSliding } from '@ionic/angular/ion-item-sliding';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { IonSegment } from '@ionic/angular/ion-segment';
import { IonSegmentButton } from '@ionic/angular/ion-segment-button';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { addIcons } from 'ionicons';
import { add, checkmark, phonePortraitOutline, trashOutline } from 'ionicons/icons';
import { workoutOf } from '../../core/catalog';
import { addDays, dayKey, dayLabel, shortDay } from '../../core/dates';
import type { StepEntry, WeightEntry, Workout } from '../../core/db';
import { dec1, num, round1 } from '../../core/format';
import { liveBy } from '../../core/live';
import { bmi } from '../../core/profile';
import { toSeries } from '../../core/series';
import { SettingsService } from '../../core/settings.service';
import { StepsSyncService } from '../../core/steps-sync.service';
import {
  deleteHabit, deleteSteps, deleteWeight, deleteWorkout, routineOn, routineScore, setHabitDone, stepsBetween,
  weightsBetween, workoutsBetween, type HabitStatus,
} from '../../core/store';
import { ActionsService } from '../../shared/actions.service';
import { ChartComponent } from '../../shared/chart.component';

type Section = 'weight' | 'steps' | 'workouts' | 'routine';

interface FitnessData {
  weights: WeightEntry[];
  steps: StepEntry[];
  workouts: Workout[];
  score: { date: string; done: number; total: number }[];
  routine: HabitStatus[];
}

@Component({
  selector: 'fw-fitness',
  imports: [
    ChartComponent, IonHeader, IonToolbar, IonTitle, IonContent, IonSegment, IonSegmentButton, IonLabel, IonButton,
    IonIcon, IonList, IonItem, IonItemSliding, IonItemOptions, IonItemOption, IonSpinner,
  ],
  templateUrl: './fitness.page.html',
  styleUrl: './fitness.page.scss',
})
export class FitnessPage {
  protected readonly act = inject(ActionsService);
  protected readonly settings = inject(SettingsService);
  protected readonly stepsSync = inject(StepsSyncService);
  protected readonly native = Capacitor.isNativePlatform();
  protected readonly num = num;
  protected readonly dec1 = dec1;
  protected readonly dayLabel = dayLabel;
  protected readonly workoutOf = workoutOf;

  protected readonly section = signal<Section>('weight');
  protected readonly ranges = [{ days: 7, label: '7 days' }, { days: 30, label: '30 days' }, { days: 90, label: '3 months' }, { days: 365, label: '1 year' }];
  protected readonly days = signal(30);
  protected readonly syncing = signal(false);
  private readonly window = computed(() => ({ to: dayKey(), from: addDays(dayKey(), -(this.days() - 1)) }));

  protected readonly data = liveBy(this.window, async ({ from, to }): Promise<FitnessData> => {
    const [weights, steps, workouts, score, routine] = await Promise.all([
      weightsBetween(from, to), stepsBetween(from, to), workoutsBetween(from, to), routineScore(from, to), routineOn(to),
    ]);
    return { weights, steps, workouts, score, routine };
  }, { weights: [], steps: [], workouts: [], score: [], routine: [] });

  protected readonly goals = this.settings.goals;

  // Weight: one point per weigh-in, so gaps between them don't look like zero.
  protected readonly weightChart = computed(() => ({
    labels: this.data().weights.map((w) => shortDay(w.date)),
    values: this.data().weights.map((w) => w.kg),
  }));
  protected readonly weightStats = computed(() => {
    const list = this.data().weights;
    const latest = this.settings.latestWeight();
    if (!latest) return null;
    const first = list[0];
    const goal = this.goals().goalWeightKg;
    return {
      kg: latest.kg,
      change: first && first.date !== latest.date ? round1(latest.kg - first.kg) : null,
      toGoal: goal ? round1(latest.kg - goal) : null,
      bmi: bmi(this.settings.profile().heightCm, latest.kg),
    };
  });

  protected readonly stepsChart = computed(() => {
    const { from, to } = this.window();
    return toSeries(from, to, new Map(this.data().steps.map((s) => [s.date, s.steps])), 'avg');
  });
  protected readonly stepStats = computed(() => {
    const steps = this.data().steps;
    const total = steps.reduce((s, e) => s + e.steps, 0);
    const best = steps.reduce<StepEntry | null>((b, e) => (!b || e.steps > b.steps ? e : b), null);
    const hitGoal = steps.filter((e) => e.steps >= this.goals().steps).length;
    return { today: steps.find((s) => s.date === dayKey())?.steps ?? 0, avg: steps.length ? Math.round(total / steps.length) : 0, best, hitGoal };
  });
  protected readonly recentSteps = computed(() => [...this.data().steps].reverse().slice(0, 14));

  protected readonly workoutChart = computed(() => {
    const { from, to } = this.window();
    const byDay = new Map<string, number>();
    for (const w of this.data().workouts) byDay.set(w.date, (byDay.get(w.date) ?? 0) + w.minutes);
    return toSeries(from, to, byDay, 'sum');
  });
  protected readonly workoutStats = computed(() => {
    const list = this.data().workouts;
    return {
      sessions: list.length,
      minutes: list.reduce((s, w) => s + w.minutes, 0),
      kcal: list.reduce((s, w) => s + w.kcal, 0),
      activeDays: new Set(list.map((w) => w.date)).size,
    };
  });

  protected readonly routineChart = computed(() => {
    const { from, to } = this.window();
    const byDay = new Map(this.data().score.filter((s) => s.total > 0).map((s) => [s.date, Math.round((s.done / s.total) * 100)]));
    return toSeries(from, to, byDay, 'avg');
  });
  protected readonly routineAvg = computed(() => {
    const days = this.data().score.filter((s) => s.total > 0);
    return days.length ? Math.round(days.reduce((s, d) => s + d.done / d.total, 0) / days.length * 100) : 0;
  });

  constructor() {
    addIcons({ add, checkmark, trashOutline, phonePortraitOutline });
    if (this.native) this.stepsSync.check();
  }

  protected setSection(value: unknown): void {
    this.section.set(value as Section);
  }

  protected async syncSteps(): Promise<void> {
    this.syncing.set(true);
    try {
      if (this.stepsSync.link() === 'needs-permission' && !(await this.stepsSync.connect())) return;
      const n = await this.stepsSync.sync(30);
      await this.act.toast(n ? `Updated ${n} days from your phone` : 'Steps are up to date');
    } catch (e) {
      await this.act.toast(`Couldn't read steps: ${(e as Error).message}`, 'error');
    } finally {
      this.syncing.set(false);
    }
  }

  protected async tick(r: HabitStatus): Promise<void> {
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
    await setHabitDone(r.habit.id!, dayKey(), !r.done);
  }

  protected async removeHabit(r: HabitStatus): Promise<void> {
    if (await this.act.confirm('Remove habit?', `"${r.habit.name}" and its streak history will be removed.`)) await deleteHabit(r.habit.id!);
  }

  protected async removeWeight(w: WeightEntry): Promise<void> {
    await deleteWeight(w.date);
  }

  protected async removeSteps(s: StepEntry): Promise<void> {
    await deleteSteps(s.date);
  }

  protected async removeWorkout(w: Workout): Promise<void> {
    await deleteWorkout(w.id!);
  }

  protected abs(n: number): number {
    return Math.abs(n);
  }

  protected reversed<T>(list: T[]): T[] {
    return [...list].reverse();
  }
}
