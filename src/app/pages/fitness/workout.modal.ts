import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonInput } from '@ionic/angular/ion-input';
import { ModalController } from '@ionic/angular/modal-controller';
import { ToastController } from '@ionic/angular/toast-controller';
import { WORKOUT_TYPES, workoutKcal } from '../../core/catalog';
import { addDays, dayKey } from '../../core/dates';
import type { DayKey, WorkoutType } from '../../core/db';
import { SettingsService } from '../../core/settings.service';
import { addWorkout } from '../../core/store';

@Component({
  selector: 'fw-workout',
  imports: [FormsModule, IonContent, IonButton, IonInput],
  template: `
    <ion-content class="ion-padding">
      <h2 class="title">Add workout</h2>

      <div class="grid-3">
        @for (w of types; track w.key) {
          <button class="choice" [class.on]="type() === w.key" (click)="type.set(w.key)">
            <span class="emoji">{{ w.emoji }}</span>{{ w.label }}
          </button>
        }
      </div>

      <p class="label">How long?</p>
      <div class="pills wrap">
        @for (m of durations; track m) {
          <button class="pill" [class.on]="minutes() === m" (click)="minutes.set(m)">{{ m }} min</button>
        }
      </div>
      <ion-input label="Or type minutes" labelPlacement="stacked" type="number" inputmode="numeric"
                 [ngModel]="minutes()" (ngModelChange)="minutes.set(+$event || 0)" />

      <p class="label">When?</p>
      <div class="pills wrap">
        <button class="pill" [class.on]="when() === today" (click)="when.set(today)">Today</button>
        <button class="pill" [class.on]="when() === yesterday" (click)="when.set(yesterday)">Yesterday</button>
      </div>

      <div class="burn">
        <span class="muted">About</span>
        <strong>{{ kcal() }} kcal</strong>
        <span class="muted">burned</span>
      </div>
      <ion-input label="Note (optional)" labelPlacement="stacked" placeholder="e.g. chest day, 5 km" [(ngModel)]="note" [maxlength]="120" />

      <ion-button expand="block" class="save" [disabled]="!(minutes() > 0)" (click)="save()">Save workout</ion-button>
    </ion-content>
  `,
  styles: `
    .title { margin: 8px 0 16px; font-size: 22px; font-weight: 700; }
    .label { margin: 20px 0 8px; font-weight: 650; }
    .pills.flush { padding: 0 0 6px; }
    .burn { display: flex; align-items: baseline; gap: 6px; margin: 20px 0 8px; font-size: 15px; }
    .burn strong { font-size: 22px; color: var(--fw-ink); }
    .save { margin-top: 20px; }
  `,
})
export class WorkoutModal implements OnInit {
  @Input() date: DayKey = dayKey();

  private readonly modalCtrl = inject(ModalController);
  private readonly toasts = inject(ToastController);
  private readonly settings = inject(SettingsService);

  protected readonly types = WORKOUT_TYPES;
  protected readonly durations = [10, 15, 20, 30, 45, 60, 90];
  protected readonly today = dayKey();
  protected readonly yesterday = addDays(this.today, -1);
  protected readonly type = signal<WorkoutType>('walk');
  protected readonly minutes = signal(30);
  protected readonly when = signal<DayKey>(this.today);
  protected readonly note = signal('');
  protected readonly kcal = computed(() => workoutKcal(this.type(), this.minutes(), this.settings.latestWeight()?.kg ?? null));

  ngOnInit(): void {
    this.when.set(this.date);
  }

  protected async save(): Promise<void> {
    await addWorkout({ date: this.when(), type: this.type(), minutes: this.minutes(), kcal: this.kcal(), note: this.note().trim() || undefined });
    const t = await this.toasts.create({ message: `Saved · ${this.minutes()} min, ${this.kcal()} kcal`, duration: 1500, color: 'dark' });
    await t.present();
    await this.modalCtrl.dismiss();
  }
}
