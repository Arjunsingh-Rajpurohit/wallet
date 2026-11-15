import { Injectable, inject } from '@angular/core';
import { ActionSheetController } from '@ionic/angular/action-sheet-controller';
import { AlertController } from '@ionic/angular/alert-controller';
import { ModalController } from '@ionic/angular/modal-controller';
import { ToastController } from '@ionic/angular/toast-controller';
import { dayKey, mealTypeNow } from '../core/dates';
import { db, type DayKey, type Expense, type MealType } from '../core/db';
import { dec1, num } from '../core/format';
import { MediaService, type MediaSource } from '../core/media.service';
import { addProgress, logSteps, logWeight } from '../core/store';

/** Every "add something" flow, so Today's shortcuts and each tab open exactly the same screens. */
@Injectable({ providedIn: 'root' })
export class ActionsService {
  private readonly modals = inject(ModalController);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly sheets = inject(ActionSheetController);
  private readonly media = inject(MediaService);

  async toast(message: string, tone: 'ok' | 'error' = 'ok'): Promise<void> {
    const t = await this.toasts.create({
      message, duration: tone === 'error' ? 3500 : 1800, position: 'bottom', positionAnchor: undefined,
      color: tone === 'error' ? 'danger' : 'dark', cssClass: 'fw-toast',
    });
    await t.present();
  }

  async confirm(header: string, message: string, ok = 'Delete', cancel = 'Cancel'): Promise<boolean> {
    const a = await this.alerts.create({
      header, message,
      buttons: [{ text: cancel, role: 'cancel' }, { text: ok, role: 'confirm', cssClass: ok === 'Delete' ? 'danger' : '' }],
    });
    await a.present();
    return (await a.onDidDismiss()).role === 'confirm';
  }

  async addFood(date: DayKey = dayKey(), type: MealType = mealTypeNow(), start: 'search' | 'photo' | 'custom' = 'search'): Promise<void> {
    await this.open(() => import('../pages/food/add-food.modal').then((m) => m.AddFoodModal), { date, type, start });
  }

  async ideas(date: DayKey = dayKey()): Promise<void> {
    await this.open(() => import('../pages/food/ideas.modal').then((m) => m.IdeasModal), { date }, true);
  }

  async addWorkout(date: DayKey = dayKey()): Promise<void> {
    await this.open(() => import('../pages/fitness/workout.modal').then((m) => m.WorkoutModal), { date }, true);
  }

  async addHabit(): Promise<void> {
    await this.open(() => import('../pages/fitness/habit.modal').then((m) => m.HabitModal), {}, true);
  }

  async addExpense(options: { date?: DayKey; expense?: Expense; scan?: MediaSource } = {}): Promise<void> {
    await this.open(() => import('../pages/money/expense.modal').then((m) => m.ExpenseModal), { date: options.date ?? dayKey(), expense: options.expense, scan: options.scan });
  }

  async logWeight(date: DayKey = dayKey()): Promise<void> {
    const last = await db.weights.orderBy('date').last();
    const kg = await this.askNumber('Log weight', 'Your weight in kg', last?.kg ?? null, 20, 400);
    if (kg === null) return;
    await logWeight(date, Math.round(kg * 10) / 10);
    await this.toast(`Saved ${dec1(kg)} kg`);
  }

  async logSteps(date: DayKey = dayKey()): Promise<void> {
    const today = await db.steps.get(date);
    const steps = await this.askNumber('Steps', date === dayKey() ? 'Steps walked today' : 'Steps walked that day', today?.steps ?? null, 0, 150000);
    if (steps === null) return;
    await logSteps(date, Math.round(steps));
    await this.toast(`Saved ${num(steps)} steps`);
  }

  async addProgress(): Promise<void> {
    const sheet = await this.sheets.create({
      header: 'Add progress photo or video',
      buttons: [
        { text: 'Take photo', data: ['photo', 'camera'] },
        { text: 'Photo from gallery', data: ['photo', 'gallery'] },
        { text: 'Record video', data: ['video', 'camera'] },
        { text: 'Video from gallery', data: ['video', 'gallery'] },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await sheet.present();
    const choice = (await sheet.onDidDismiss()).data as ['photo' | 'video', MediaSource] | undefined;
    if (!choice) return;
    try {
      const saved = choice[0] === 'photo'
        ? await this.media.photo(choice[1], 'progress')
        : await this.media.video(choice[1], 'progress');
      if (!saved) return;
      await addProgress({ date: dayKey(), kind: saved.kind, path: saved.path, thumb: saved.thumb });
      await this.toast(saved.kind === 'photo' ? 'Progress photo saved' : 'Progress video saved');
    } catch (e) {
      await this.toast(`Couldn't save it: ${(e as Error).message}`, 'error');
    }
  }

  /** Each form is fetched the first time it is opened, so the app itself starts light. */
  private async open(load: () => Promise<unknown>, componentProps: object, sheet = false): Promise<void> {
    const modal = await this.modals.create({
      component: (await load()) as never,
      componentProps,
      ...(sheet ? { breakpoints: [0, 1], initialBreakpoint: 1, cssClass: 'sheet', handle: true } : {}),
    });
    await modal.present();
    await modal.onDidDismiss();
  }

  private async askNumber(header: string, label: string, value: number | null, min: number, max: number): Promise<number | null> {
    const a = await this.alerts.create({
      header,
      message: label,
      inputs: [{ name: 'value', type: 'number', value: value ?? '', min, max, attributes: { inputmode: 'decimal', autofocus: true } }],
      buttons: [{ text: 'Cancel', role: 'cancel' }, { text: 'Save', role: 'confirm' }],
    });
    await a.present();
    const result = await a.onDidDismiss();
    if (result.role !== 'confirm') return null;
    const n = Number(result.data?.values?.value);
    if (!Number.isFinite(n) || n < min || n > max || String(result.data?.values?.value ?? '').trim() === '') {
      await this.toast(`Please enter a number between ${num(min)} and ${num(max)}.`, 'error');
      return null;
    }
    return n;
  }
}
