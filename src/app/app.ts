import { Component, OnInit, inject } from '@angular/core';
import { IonApp } from '@ionic/angular/ion-app';
import { IonRouterOutlet } from '@ionic/angular/ion-router-outlet';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { DriveService } from './core/drive.service';
import { StepsSyncService } from './core/steps-sync.service';
import { addDueRepeats } from './core/store';
import { HAS_MONEY } from './core/variant';
import { ActionsService } from './shared/actions.service';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet],
  template: `<ion-app><ion-router-outlet /></ion-app>`,
})
export class App implements OnInit {
  private readonly steps = inject(StepsSyncService);

  private readonly drive = inject(DriveService);
  private readonly act = inject(ActionsService);

  ngOnInit(): void {
    // Rent, salary and other monthly repeats that came due since the last visit.
    if (HAS_MONEY) {
      addDueRepeats().then((n) => {
        if (n) void this.act.toast(`${n} monthly ${n === 1 ? 'entry' : 'entries'} added`);
      }).catch(() => undefined);
    }
    if (!Capacitor.isNativePlatform()) return this.startWeb();
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => undefined);
    // Steps arrive on their own: on opening the app and each time it comes back to the front.
    this.steps.sync(7).catch(() => undefined);
    CapApp.addListener('resume', () => this.steps.sync(3).catch(() => undefined));
  }

  private startWeb(): void {
    // Ask the browser not to clear this site's data when the phone runs low on space.
    navigator.storage?.persist?.().catch(() => undefined);
    this.drive.ask = (date) => this.act.confirm(
      'Two different copies',
      `Google Drive has a copy from ${date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}, and this phone has changes too. Which one do you keep?`,
      'Use Drive copy', 'Keep this phone',
    );
    this.drive.start();
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => undefined);
  }
}
