import { Component } from '@angular/core';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonTabBar } from '@ionic/angular/ion-tab-bar';
import { IonTabButton } from '@ionic/angular/ion-tab-button';
import { IonTabs } from '@ionic/angular/ion-tabs';
import { addIcons } from 'ionicons';
import { HAS_FIT, HAS_MONEY } from '../../core/variant';
import { barbell, barbellOutline, home, homeOutline, images, imagesOutline, restaurant, restaurantOutline, wallet, walletOutline } from 'ionicons/icons';

@Component({
  selector: 'fw-tabs',
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  // One screen needs no tab bar. A class, not [hidden]: Ionic shows the bar again when the keyboard closes.
  styles: `ion-tab-bar.single { display: none; }`,
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom" [class.single]="tabs.length < 2">
        @for (tab of tabs; track tab.key) {
          <ion-tab-button [tab]="tab.key">
            <ion-icon [name]="tab.icon" />
            <ion-label>{{ tab.label }}</ion-label>
          </ion-tab-button>
        }
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class TabsPage {
  protected readonly tabs = [
    { key: 'today', label: 'Today', icon: 'home-outline', on: HAS_FIT },
    { key: 'food', label: 'Food', icon: 'restaurant-outline', on: HAS_FIT },
    { key: 'fitness', label: 'Fitness', icon: 'barbell-outline', on: HAS_FIT },
    { key: 'money', label: 'Money', icon: 'wallet-outline', on: HAS_MONEY },
    { key: 'photos', label: 'Progress', icon: 'images-outline', on: HAS_FIT },
  ].filter((t) => t.on);

  constructor() {
    addIcons({ home, homeOutline, restaurant, restaurantOutline, barbell, barbellOutline, wallet, walletOutline, images, imagesOutline });
  }
}
