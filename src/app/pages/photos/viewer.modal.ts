import { Component, Input, inject, signal, OnInit } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { AlertController } from '@ionic/angular/alert-controller';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { addIcons } from 'ionicons';
import { createOutline, play, trashOutline } from 'ionicons/icons';
import { dayLabel } from '../../core/dates';
import { db } from '../../core/db';
import { dec1 } from '../../core/format';
import { MediaService, MediaSrcDirective } from '../../core/media.service';
import { deleteProgress } from '../../core/store';
import type { ProgressView } from './photos.page';

@Component({
  selector: 'fw-viewer',
  imports: [MediaSrcDirective, IonHeader, IonToolbar, IonButtons, IonButton, IonContent, IonIcon],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-button (click)="close()">Close</ion-button></ion-buttons>
        <ion-buttons slot="end">
          <ion-button (click)="editNote()" aria-label="Edit note"><ion-icon slot="icon-only" name="create-outline" /></ion-button>
          <ion-button color="danger" (click)="remove()" aria-label="Delete"><ion-icon slot="icon-only" name="trash-outline" /></ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="media">
        @if (item.kind === 'photo') {
          <img [fwSrc]="item.path" alt="Progress photo" />
        } @else {
          <video [fwSrc]="item.path" controls playsinline preload="metadata" [attr.poster]="null"></video>
          @if (native) {
            <ion-button fill="clear" size="small" (click)="openPlayer()"><ion-icon slot="start" name="play" />Open in full-screen player</ion-button>
          }
        }
      </div>
      <div class="info">
        <strong>{{ dayLabel(item.date) }}</strong>
        @if (item.kg) { <span class="ink-2"> · {{ dec1(item.kg) }} kg</span> }
        @if (note()) { <p>{{ note() }}</p> }
      </div>
    </ion-content>
  `,
  styles: `
    .media { display: flex; flex-direction: column; align-items: center; padding: 8px 0; }
    .media img, .media video { width: 100%; max-height: 70vh; object-fit: contain; background: #000; }
    .info { padding: 12px 20px; }
    .info p { margin: 8px 0 0; color: var(--fw-ink-2); }
  `,
})
export class ViewerModal implements OnInit {
  @Input({ required: true }) item!: ProgressView;

  private readonly modalCtrl = inject(ModalController);
  private readonly alerts = inject(AlertController);
  private readonly media = inject(MediaService);
  protected readonly dayLabel = dayLabel;
  protected readonly dec1 = dec1;
  protected readonly native = Capacitor.isNativePlatform();
  protected readonly note = signal('');

  ngOnInit(): void {
    this.note.set(this.item.note ?? '');
  }

  protected close(): Promise<boolean> {
    return this.modalCtrl.dismiss();
  }

  protected async openPlayer(): Promise<void> {
    await this.media.playVideo(this.item.path);
  }

  protected async editNote(): Promise<void> {
    const a = await this.alerts.create({
      header: 'Note',
      inputs: [{ name: 'note', type: 'textarea', value: this.note(), placeholder: 'e.g. Week 6 — waist 84 cm', attributes: { maxlength: 200 } }],
      buttons: [{ text: 'Cancel', role: 'cancel' }, { text: 'Save', role: 'confirm' }],
    });
    await a.present();
    const r = await a.onDidDismiss();
    if (r.role !== 'confirm') return;
    const note = String(r.data?.values?.note ?? '').trim();
    await db.progress.update(this.item.id!, { note: note || undefined });
    this.note.set(note);
  }

  protected async remove(): Promise<void> {
    const a = await this.alerts.create({
      header: 'Delete?', message: `This ${this.item.kind} will be removed from the app.`,
      buttons: [{ text: 'Cancel', role: 'cancel' }, { text: 'Delete', role: 'confirm' }],
    });
    await a.present();
    if ((await a.onDidDismiss()).role !== 'confirm') return;
    await deleteProgress(this.item.id!);
    await this.media.remove(this.item.path, this.item.thumb);
    await this.modalCtrl.dismiss();
  }
}
