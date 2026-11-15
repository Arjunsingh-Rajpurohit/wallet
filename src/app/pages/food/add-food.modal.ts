import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonCheckbox } from '@ionic/angular/ion-checkbox';
import { IonContent } from '@ionic/angular/ion-content';
import { IonFooter } from '@ionic/angular/ion-footer';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { IonSearchbar } from '@ionic/angular/ion-searchbar';
import { IonSegment } from '@ionic/angular/ion-segment';
import { IonSegmentButton } from '@ionic/angular/ion-segment-button';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { ToastController } from '@ionic/angular/toast-controller';
import { addIcons } from 'ionicons';
import { addCircle, remove, add, sparkles } from 'ionicons/icons';
import { AiService, type ScannedFood } from '../../core/ai.service';
import { MEAL_TYPES } from '../../core/catalog';
import { dayKey, mealTypeNow } from '../../core/dates';
import { db, type DayKey, type Meal, type MealType } from '../../core/db';
import { round1 } from '../../core/format';
import { FOODS, searchFoods, type Food } from '../../core/food-db';
import { live } from '../../core/live';
import { MediaService, MediaSrcDirective, type MediaSource } from '../../core/media.service';
import { SettingsService } from '../../core/settings.service';
import { addMeals } from '../../core/store';

type Tab = 'search' | 'photo' | 'custom';
type NewMeal = Omit<Meal, 'id' | 'createdAt'>;

@Component({
  selector: 'fw-add-food',
  imports: [
    FormsModule, MediaSrcDirective, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonSegment,
    IonSegmentButton, IonLabel, IonSearchbar, IonList, IonItem, IonIcon, IonFooter, IonInput, IonCheckbox, IonSpinner,
  ],
  templateUrl: './add-food.modal.html',
  styleUrl: './add-food.modal.scss',
})
export class AddFoodModal implements OnInit {
  @Input() date: DayKey = dayKey();
  @Input() type: MealType = mealTypeNow();
  @Input() start: Tab = 'search';

  private readonly modalCtrl = inject(ModalController);
  private readonly toasts = inject(ToastController);
  private readonly router = inject(Router);
  private readonly ai = inject(AiService);
  private readonly media = inject(MediaService);
  private readonly settings = inject(SettingsService);

  protected readonly mealTypes = MEAL_TYPES;
  protected readonly tab = signal<Tab>('search');
  protected readonly meal = signal<MealType>('lunch');
  protected readonly query = signal('');
  protected readonly picked = signal<Food | null>(null);
  protected readonly qty = signal(1);
  protected readonly added = signal<string[]>([]);
  protected readonly addedKcal = signal(0);
  protected readonly aiReady = this.settings.aiReady;

  protected readonly results = computed(() => searchFoods(this.query()));
  private readonly lastMeals = live(() => db.meals.reverse().limit(80).toArray(), [] as Meal[]);
  /** Things you actually eat, newest first — one tap adds the same again. */
  protected readonly recent = computed(() => {
    const seen = new Set<string>();
    return this.lastMeals().filter((m) => {
      const key = `${m.name}|${m.kcal}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 8);
  });

  // Photo
  protected readonly photo = signal<string | null>(null);
  protected readonly reading = signal(false);
  protected readonly scanError = signal('');
  protected readonly scanNote = signal('');
  protected readonly scanned = signal<(ScannedFood & { on: boolean })[]>([]);
  protected readonly chosen = computed(() => this.scanned().filter((i) => i.on));
  protected readonly chosenKcal = computed(() => this.chosen().reduce((s, i) => s + (Number(i.kcal) || 0), 0));

  // Type it yourself
  protected readonly name = signal('');
  protected readonly kcal = signal<number | null>(null);
  protected readonly protein = signal<number | null>(null);
  protected readonly carbs = signal<number | null>(null);
  protected readonly fat = signal<number | null>(null);

  constructor() {
    addIcons({ addCircle, add, remove, sparkles });
  }

  ngOnInit(): void {
    this.tab.set(this.start);
    this.meal.set(this.type);
  }

  protected setTab(value: unknown): void {
    this.tab.set(value as Tab);
    this.picked.set(null);
  }

  protected pick(food: Food): void {
    this.picked.set(food);
    this.qty.set(1);
  }

  protected step(by: number): void {
    this.qty.update((q) => Math.max(0.5, Math.min(20, q + by)));
  }

  protected async addPicked(): Promise<void> {
    const food = this.picked();
    if (!food) return;
    const q = this.qty();
    await this.save([{
      date: this.date, type: this.meal(), source: 'food-list', name: food.name,
      portion: q === 1 ? food.serving : `${q} × ${food.serving}`,
      kcal: Math.round(food.kcal * q), protein: round1(food.protein * q), carbs: round1(food.carbs * q), fat: round1(food.fat * q),
    }]);
    this.picked.set(null);
  }

  protected async again(m: Meal): Promise<void> {
    await this.save([{
      date: this.date, type: this.meal(), source: m.source === 'photo-ai' ? 'manual' : m.source, name: m.name, portion: m.portion,
      kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat,
    }]);
  }

  protected async addCustom(): Promise<void> {
    const kcal = Number(this.kcal());
    if (!this.name().trim() || !(kcal > 0)) return;
    await this.save([{
      date: this.date, type: this.meal(), source: 'manual', name: this.name().trim(),
      kcal: Math.round(kcal), protein: round1(Number(this.protein()) || 0), carbs: round1(Number(this.carbs()) || 0), fat: round1(Number(this.fat()) || 0),
    }]);
    this.name.set('');
    this.kcal.set(null);
    this.protein.set(null);
    this.carbs.set(null);
    this.fat.set(null);
  }

  protected async snap(source: MediaSource): Promise<void> {
    this.scanError.set('');
    try {
      const saved = await this.media.photo(source, 'food');
      if (!saved) return;
      this.photo.set(saved.path);
      await this.read(saved.path);
    } catch (e) {
      this.scanError.set((e as Error).message);
    }
  }

  protected async read(path: string): Promise<void> {
    this.reading.set(true);
    this.scanError.set('');
    this.scanned.set([]);
    try {
      const scan = await this.ai.scanFood(await this.media.readBase64(path), 'image/jpeg');
      this.scanNote.set(scan.note);
      this.scanned.set(scan.items.map((i) => ({ ...i, on: true })));
      if (!scan.items.length) this.scanError.set(scan.note || 'No food found in this photo.');
    } catch (e) {
      this.scanError.set((e as Error).message);
    } finally {
      this.reading.set(false);
    }
  }

  protected toggle(index: number): void {
    this.scanned.update((items) => items.map((it, i) => (i === index ? { ...it, on: !it.on } : it)));
  }

  /** Changing the calories scales protein, carbs and fat with them — it's the same plate, more or less of it. */
  protected setKcal(index: number, value: unknown): void {
    const kcal = Math.max(0, Math.round(Number(value) || 0));
    this.scanned.update((items) => items.map((it, i) => {
      if (i !== index) return it;
      const k = it.kcal > 0 ? kcal / it.kcal : 1;
      return { ...it, kcal, protein: round1(it.protein * k), carbs: round1(it.carbs * k), fat: round1(it.fat * k) };
    }));
  }

  protected async addScanned(): Promise<void> {
    const items = this.chosen();
    if (!items.length) return;
    await this.save(items.map((i) => ({
      date: this.date, type: this.meal(), source: 'photo-ai' as const, name: i.name, portion: i.portion,
      kcal: i.kcal, protein: i.protein, carbs: i.carbs, fat: i.fat, photo: this.photo() ?? undefined,
    })));
    this.photo.set(null);
    this.scanned.set([]);
    this.tab.set('search');
  }

  protected async discardPhoto(): Promise<void> {
    const path = this.photo();
    this.photo.set(null);
    this.scanned.set([]);
    this.scanError.set('');
    await this.media.remove(path ?? undefined);
  }

  protected async setUpAi(): Promise<void> {
    await this.modalCtrl.dismiss();
    await this.router.navigateByUrl('/settings#ai');
  }

  protected close(): Promise<boolean> {
    // A scanned photo whose items were never added is not kept (adding clears `photo`).
    const unsaved = this.photo();
    if (unsaved) this.media.remove(unsaved);
    return this.modalCtrl.dismiss();
  }

  private async save(meals: NewMeal[]): Promise<void> {
    await addMeals(meals);
    const kcal = meals.reduce((s, m) => s + m.kcal, 0);
    this.added.update((names) => [...names, ...meals.map((m) => m.name)]);
    this.addedKcal.update((k) => k + kcal);
    const t = await this.toasts.create({
      message: meals.length === 1 ? `Added ${meals[0].name} · ${kcal} kcal` : `Added ${meals.length} items · ${kcal} kcal`,
      duration: 1500, color: 'dark', position: 'bottom',
    });
    await t.present();
  }

  protected readonly foodsCount = FOODS.length;
}
