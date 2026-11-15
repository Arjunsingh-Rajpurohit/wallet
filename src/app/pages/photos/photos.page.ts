import { Component, computed, inject, signal } from '@angular/core';
import { IonButton, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar, ModalController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, gitCompareOutline, play } from 'ionicons/icons';
import { shortDay } from '../../core/dates';
import { db, type ProgressItem, type WeightEntry } from '../../core/db';
import { dec1 } from '../../core/format';
import { live } from '../../core/live';
import { MediaSrcDirective } from '../../core/media.service';
import { ActionsService } from '../../shared/actions.service';
import { CompareModal } from './compare.modal';
import { ViewerModal } from './viewer.modal';

export interface ProgressView extends ProgressItem {
  /** The last weigh-in on or before the day the photo was taken. */
  kg: number | null;
}

@Component({
  selector: 'fw-photos',
  imports: [MediaSrcDirective, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon],
  templateUrl: './photos.page.html',
  styleUrl: './photos.page.scss',
})
export class PhotosPage {
  protected readonly act = inject(ActionsService);
  private readonly modals = inject(ModalController);
  protected readonly shortDay = shortDay;
  protected readonly dec1 = dec1;

  private readonly raw = live(async () => {
    const [items, weights] = await Promise.all([db.progress.orderBy('date').reverse().toArray(), db.weights.orderBy('date').toArray()]);
    return { items, weights };
  }, { items: [] as ProgressItem[], weights: [] as WeightEntry[] });

  protected readonly items = computed<ProgressView[]>(() => {
    const { items, weights } = this.raw();
    return items.map((item) => {
      let kg: number | null = null;
      for (const w of weights) {
        if (w.date > item.date) break;
        kg = w.kg;
      }
      return { ...item, kg };
    });
  });

  protected readonly comparing = signal(false);
  protected readonly picked = signal<number[]>([]);

  constructor() {
    addIcons({ add, gitCompareOutline, play });
  }

  protected toggleCompare(): void {
    this.comparing.update((c) => !c);
    this.picked.set([]);
  }

  protected async tap(item: ProgressView): Promise<void> {
    if (!this.comparing()) {
      const modal = await this.modals.create({ component: ViewerModal, componentProps: { item } });
      await modal.present();
      return;
    }
    const picked = this.picked().includes(item.id!) ? this.picked().filter((id) => id !== item.id) : [...this.picked(), item.id!];
    this.picked.set(picked.slice(-2));
    if (this.picked().length === 2) {
      const [a, b] = this.items().filter((i) => this.picked().includes(i.id!)).sort((x, y) => x.date.localeCompare(y.date));
      const modal = await this.modals.create({ component: CompareModal, componentProps: { before: a, after: b } });
      await modal.present();
      await modal.onDidDismiss();
      this.comparing.set(false);
      this.picked.set([]);
    }
  }
}
