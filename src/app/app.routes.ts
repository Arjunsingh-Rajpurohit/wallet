import { Routes } from '@angular/router';
import { HAS_FIT, HAS_MONEY, HOME } from './core/variant';
import { TabsPage } from './pages/tabs/tabs.page';

const home = HOME.split('/').pop()!;

export const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      ...(HAS_FIT ? [
        { path: 'today', loadComponent: () => import('./pages/today/today.page').then((m) => m.TodayPage) },
        { path: 'food', loadComponent: () => import('./pages/food/food.page').then((m) => m.FoodPage) },
        { path: 'fitness', loadComponent: () => import('./pages/fitness/fitness.page').then((m) => m.FitnessPage) },
        { path: 'photos', loadComponent: () => import('./pages/photos/photos.page').then((m) => m.PhotosPage) },
      ] : []),
      ...(HAS_MONEY ? [
        { path: 'money', loadComponent: () => import('./pages/money/money.page').then((m) => m.MoneyPage) },
      ] : []),
      { path: '', redirectTo: home, pathMatch: 'full' as const },
      { path: '**', redirectTo: home },
    ],
  },
  { path: 'settings', loadComponent: () => import('./pages/settings/settings.page').then((m) => m.SettingsPage) },
  { path: '', redirectTo: HOME, pathMatch: 'full' },
  { path: '**', redirectTo: HOME },
];
