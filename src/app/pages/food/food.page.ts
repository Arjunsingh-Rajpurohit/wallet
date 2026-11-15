import { Component, computed, inject, signal } from '@angular/core';
import {
  ActionSheetController, AlertController, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonItem,
  IonItemOption, IonItemOptions, IonItemSliding, IonLabel, IonList, IonTitle, IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, chevronBack, chevronForward } from 'ionicons/icons';
import { MEAL_TYPES } from '../../core/catalog';
import { addDays, dayKey, dayLabel, shortDay } from '../../core/dates';
import type { Meal } from '../../core/db';
import { num, round1 } from '../../core/format';
import { liveBy } from '../../core/live';
import { MediaService, MediaSrcDirective } from '../../core/media.service';
import { SettingsService } from '../../core/settings.service';
import { addMeals, deleteMeal, kcalByDay, mealsOn, sumMeals, updateMeal } from '../../core/store';
import { ActionsService } from '../../shared/actions.service';
import { ChartComponent } from '../../shared/chart.component';

@Component({
  selector: 'fw-food',
  imports: [
    MediaSrcDirective, ChartComponent, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonItemSliding,
    IonItemOptions, IonItemOption, IonLabel, IonIcon, IonFab, IonFabButton,
  ],
  templateUrl: './food.page.html',
  styleUrl: './food.page.scss',
})
export class FoodPage {
  protected readonly act = inject(ActionsService);
  private readonly settings = inject(SettingsService);
  private readonly sheets = inject(ActionSheetController);
  private readonly alerts = inject(AlertController);
  private readonly media = inject(MediaService);

  protected readonly num = num;
  protected readonly mealTypes = MEAL_TYPES;
  protected readonly date = signal(dayKey());
  protected readonly isToday = computed(() => this.date() === dayKey());
  protected readonly label = computed(() => dayLabel(this.date()));
  protected readonly goals = this.settings.goals;

  protected readonly meals = liveBy(this.date, mealsOn, [] as Meal[]);
  protected readonly totals = computed(() => sumMeals(this.meals()));
  protected readonly groups = computed(() => MEAL_TYPES.map((t) => {
    const items = this.meals().filter((m) => m.type === t.key);
    return { ...t, items, kcal: items.reduce((s, m) => s + m.kcal, 0) };
  }));

  private readonly history = liveBy(this.date, (d) => kcalByDay(addDays(d, -13), d), []);
  protected readonly chartLabels = computed(() => this.history().map((h) => shortDay(h.date)));
  protected readonly chartValues = computed(() => this.history().map((h) => h.kcal));
  protected readonly avgKcal = computed(() => {
    const logged = this.history().filter((h) => h.kcal > 0);
    return logged.length ? Math.round(logged.reduce((s, h) => s + h.kcal, 0) / logged.length) : 0;
  });

  constructor() {
    addIcons({ add, chevronBack, chevronForward });
  }

  protected move(days: number): void {
    const next = addDays(this.date(), days);
    if (next <= dayKey()) this.date.set(next);
  }

  protected pct(value: number, max: number): number {
    return max > 0 ? Math.min(100, (value / max) * 100) : 0;
  }

  protected async open(meal: Meal): Promise<void> {
    const sheet = await this.sheets.create({
      header: `${meal.name} · ${meal.kcal} kcal`,
      buttons: [
        { text: 'Edit', data: 'edit' },
        { text: 'Add again', data: 'again' },
        { text: 'Delete', role: 'destructive', data: 'delete' },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await sheet.present();
    const { data } = await sheet.onDidDismiss();
    if (data === 'edit') await this.edit(meal);
    if (data === 'delete') await this.remove(meal);
    if (data === 'again') {
      const { id: _id, createdAt: _at, ...copy } = meal;
      await addMeals([{ ...copy, date: this.date() }]);
    }
  }

  protected async remove(meal: Meal): Promise<void> {
    const unusedPhoto = await deleteMeal(meal);
    await this.media.remove(unusedPhoto);
    await this.act.toast(`Removed ${meal.name}`);
  }

  private async edit(meal: Meal): Promise<void> {
    const a = await this.alerts.create({
      header: 'Edit food',
      inputs: [
        { name: 'name', type: 'text', value: meal.name, placeholder: 'Name', attributes: { maxlength: 80 } },
        { name: 'kcal', type: 'number', value: meal.kcal, placeholder: 'Calories (kcal)', min: 0 },
        { name: 'protein', type: 'number', value: meal.protein, placeholder: 'Protein (g)', min: 0 },
        { name: 'carbs', type: 'number', value: meal.carbs, placeholder: 'Carbs (g)', min: 0 },
        { name: 'fat', type: 'number', value: meal.fat, placeholder: 'Fat (g)', min: 0 },
      ],
      buttons: [{ text: 'Cancel', role: 'cancel' }, { text: 'Save', role: 'confirm' }],
    });
    await a.present();
    const result = await a.onDidDismiss();
    if (result.role !== 'confirm') return;
    const v = result.data?.values ?? {};
    await updateMeal(meal.id!, {
      name: String(v.name || meal.name).trim(),
      kcal: Math.max(0, Math.round(Number(v.kcal) || 0)),
      protein: round1(Math.max(0, Number(v.protein) || 0)),
      carbs: round1(Math.max(0, Number(v.carbs) || 0)),
      fat: round1(Math.max(0, Number(v.fat) || 0)),
    });
  }
}
