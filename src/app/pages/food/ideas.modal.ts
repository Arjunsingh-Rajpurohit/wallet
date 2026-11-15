import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { ModalController } from '@ionic/angular/modal-controller';
import { ToastController } from '@ionic/angular/toast-controller';
import { addIcons } from 'ionicons';
import { sparkles } from 'ionicons/icons';
import { AiService, type AiMealIdea } from '../../core/ai.service';
import { MEAL_TYPES } from '../../core/catalog';
import { dayKey, mealTypeNow } from '../../core/dates';
import type { DayKey, Meal, MealType } from '../../core/db';
import { suggestMeals, type Suggestion } from '../../core/meal-ideas';
import { DIETS } from '../../core/profile';
import { SettingsService } from '../../core/settings.service';
import { addMeals, mealsOn, sumMeals } from '../../core/store';

@Component({
  selector: 'fw-ideas',
  imports: [IonContent, IonButton, IonIcon, IonSpinner],
  template: `
    <ion-content class="ion-padding">
      <h2 class="title">What should I eat?</h2>
      <div class="meal-picker">
        @for (m of mealTypes; track m.key) {
          <button class="pill" [class.on]="slot() === m.key" (click)="slot.set(m.key); aiIdeas.set([])">{{ m.label }}</button>
        }
      </div>
      <p class="headline">{{ result().headline }}</p>

      @for (idea of result().ideas; track idea.name) {
        <div class="idea">
          <div class="idea-text">
            <strong>{{ idea.name }}</strong>
            <span class="muted small">{{ idea.why }} · C {{ idea.carbs }} g · F {{ idea.fat }} g</span>
          </div>
          <ion-button size="small" (click)="add(idea.name, '', idea)">Add</ion-button>
        </div>
      }

      @if (aiReady()) {
        @for (idea of aiIdeas(); track idea.name) {
          <div class="idea">
            <div class="idea-text">
              <strong>{{ idea.name }} <span class="ai-badge">✨ AI</span></strong>
              <span class="muted small">{{ idea.portion }} · {{ idea.kcal }} kcal · {{ idea.protein }} g protein</span>
              <span class="muted small">{{ idea.why }}</span>
            </div>
            <ion-button size="small" (click)="add(idea.name, idea.portion, idea)">Add</ion-button>
          </div>
        }
        <ion-button expand="block" fill="outline" class="ai-btn" [disabled]="asking()" (click)="askAi()">
          @if (asking()) { <ion-spinner name="dots" /> } @else { <ion-icon name="sparkles" slot="start" />More ideas from AI }
        </ion-button>
        @if (aiError()) { <p class="error">{{ aiError() }}</p> }
      }
      <p class="muted small foot">Based on your {{ dietLabel() }} diet and today's goal. Change both in Settings.</p>
    </ion-content>
  `,
  styles: `
    .title { margin: 8px 0 4px; font-size: 22px; font-weight: 700; }
    .meal-picker { padding: 8px 0; }
    .headline { color: var(--fw-ink-2); margin: 8px 0 12px; }
    .idea { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px solid var(--fw-border); }
    .idea-text { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .ai-btn { margin-top: 16px; }
    .error { color: var(--fw-bad); font-weight: 550; }
    .foot { margin-top: 16px; }
  `,
})
export class IdeasModal implements OnInit {
  @Input() date: DayKey = dayKey();

  private readonly modalCtrl = inject(ModalController);
  private readonly toasts = inject(ToastController);
  private readonly ai = inject(AiService);
  private readonly settings = inject(SettingsService);

  protected readonly mealTypes = MEAL_TYPES;
  protected readonly slot = signal<MealType>(mealTypeNow());
  protected readonly meals = signal<Meal[]>([]);
  protected readonly aiReady = this.settings.aiReady;
  protected readonly aiIdeas = signal<AiMealIdea[]>([]);
  protected readonly asking = signal(false);
  protected readonly aiError = signal('');

  protected readonly result = computed(() => {
    const goals = this.settings.goals();
    const eaten = sumMeals(this.meals());
    return suggestMeals(goals.kcal - eaten.kcal, goals.protein - eaten.protein, this.settings.profile().diet, this.slot());
  });
  protected readonly dietLabel = computed(() => DIETS.find((d) => d.key === this.settings.profile().diet)?.label.toLowerCase() ?? '');

  async ngOnInit(): Promise<void> {
    this.meals.set(await mealsOn(this.date));
  }

  protected async askAi(): Promise<void> {
    this.asking.set(true);
    this.aiError.set('');
    try {
      const r = this.result();
      this.aiIdeas.set(await this.ai.suggestMeals({
        kcal: Math.max(0, r.remainingKcal), protein: r.remainingProtein, slot: this.slot(),
        diet: this.dietLabel(), eaten: this.meals().map((m) => m.name),
      }));
    } catch (e) {
      this.aiError.set((e as Error).message);
    } finally {
      this.asking.set(false);
    }
  }

  protected async add(name: string, portion: string, idea: Suggestion | AiMealIdea): Promise<void> {
    await addMeals([{
      date: this.date, type: this.slot(), source: 'idea', name, portion: portion || undefined,
      kcal: Math.round(idea.kcal), protein: idea.protein, carbs: idea.carbs, fat: idea.fat,
    }]);
    const t = await this.toasts.create({ message: `Added ${name}`, duration: 1500, color: 'dark' });
    await t.present();
    await this.modalCtrl.dismiss();
  }
}
