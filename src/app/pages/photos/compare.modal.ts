import { Component, Input, computed, inject, signal, OnInit } from '@angular/core';
import { IonButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar, ModalController } from '@ionic/angular';
import { parseDay, shortDay } from '../../core/dates';
import { dec1, round1 } from '../../core/format';
import { MediaSrcDirective } from '../../core/media.service';
import type { ProgressView } from './photos.page';

@Component({
  selector: 'fw-compare',
  imports: [MediaSrcDirective, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-button (click)="close()">Close</ion-button></ion-buttons>
        <ion-title>Before & after</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="pair">
        @for (side of sides(); track side.label) {
          <figure>
            <img [fwSrc]="side.item.kind === 'video' ? side.item.thumb : side.item.path" [alt]="side.label" />
            <figcaption>
              <strong>{{ side.label }}</strong>
              <span>{{ shortDay(side.item.date) }}{{ side.item.kg ? ' · ' + dec1(side.item.kg) + ' kg' : '' }}</span>
            </figcaption>
          </figure>
        }
      </div>
      <p class="summary">{{ summary() }}</p>
    </ion-content>
  `,
  styles: `
    .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 12px; }
    figure { margin: 0; }
    img { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; border-radius: 14px; background: var(--fw-wash); display: block; }
    figcaption { display: flex; flex-direction: column; padding: 8px 2px; font-size: 14px; }
    figcaption span { color: var(--fw-ink-2); }
    .summary { margin: 4px 16px; font-size: 18px; font-weight: 650; text-align: center; }
  `,
})
export class CompareModal implements OnInit {
  @Input({ required: true }) before!: ProgressView;
  @Input({ required: true }) after!: ProgressView;

  private readonly modalCtrl = inject(ModalController);
  protected readonly shortDay = shortDay;
  protected readonly dec1 = dec1;
  private readonly pair = signal<[ProgressView, ProgressView] | null>(null);

  protected readonly sides = computed(() => {
    const p = this.pair();
    return p ? [{ label: 'Before', item: p[0] }, { label: 'After', item: p[1] }] : [];
  });

  /** "−3.2 kg in 45 days" — the reason you took the photos. */
  protected readonly summary = computed(() => {
    const p = this.pair();
    if (!p) return '';
    const days = Math.round((parseDay(p[1].date).getTime() - parseDay(p[0].date).getTime()) / 86400000);
    const span = days === 0 ? 'the same day' : `${days} ${days === 1 ? 'day' : 'days'}`;
    if (p[0].kg && p[1].kg) {
      const diff = round1(p[1].kg - p[0].kg);
      return `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${dec1(Math.abs(diff))} kg in ${span}`;
    }
    return days === 0 ? 'Taken the same day' : `${span} apart`;
  });

  ngOnInit(): void {
    this.pair.set([this.before, this.after]);
  }

  protected close(): Promise<boolean> {
    return this.modalCtrl.dismiss();
  }
}
