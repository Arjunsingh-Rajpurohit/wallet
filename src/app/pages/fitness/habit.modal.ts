import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton, IonContent, IonInput, ModalController } from '@ionic/angular';
import { HABIT_IDEAS } from '../../core/catalog';
import { dayKey } from '../../core/dates';
import { addHabit } from '../../core/store';

const EMOJIS = ['✅', '💧', '🏋️', '🚶', '😴', '🥗', '📖', '🧘', '🚫', '🍎', '💊', '🙏', '☀️', '📵', '🦷', '✍️'];

@Component({
  selector: 'fw-habit',
  imports: [FormsModule, IonContent, IonButton, IonInput],
  template: `
    <ion-content class="ion-padding">
      <h2 class="title">Add to your routine</h2>
      <p class="muted">Tap one to add it, or write your own.</p>
      <div class="ideas">
        @for (h of ideas; track h.name) {
          <button class="pill" (click)="save(h.name, h.emoji)">{{ h.emoji }} {{ h.name }}</button>
        }
      </div>

      <p class="label">Your own</p>
      <ion-input label="Habit" labelPlacement="stacked" placeholder="e.g. Stretch 5 minutes" [(ngModel)]="name" [maxlength]="40" />
      <div class="emojis">
        @for (e of emojis; track e) {
          <button [class.on]="emoji() === e" (click)="emoji.set(e)" [attr.aria-label]="'Icon ' + e">{{ e }}</button>
        }
      </div>
      <ion-button expand="block" [disabled]="!name().trim()" (click)="save(name().trim(), emoji())">Add habit</ion-button>
    </ion-content>
  `,
  styles: `
    .title { margin: 8px 0 4px; font-size: 22px; font-weight: 700; }
    .ideas { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
    .label { margin: 20px 0 4px; font-weight: 650; }
    .emojis { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; margin: 12px 0 20px; }
    .emojis button { font-size: 22px; height: 42px; border-radius: 12px; border: 1.5px solid var(--fw-border); background: var(--fw-card); }
    .emojis button.on { border-color: var(--ion-color-primary); background: rgba(var(--ion-color-primary-rgb), 0.1); }
  `,
})
export class HabitModal {
  private readonly modalCtrl = inject(ModalController);
  protected readonly ideas = HABIT_IDEAS;
  protected readonly emojis = EMOJIS;
  protected readonly name = signal('');
  protected readonly emoji = signal('✅');

  protected async save(name: string, emoji: string): Promise<void> {
    await addHabit(name, emoji, dayKey());
    await this.modalCtrl.dismiss();
  }
}
