import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonFab } from '@ionic/angular/ion-fab';
import { IonFabButton } from '@ionic/angular/ion-fab-button';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { addIcons } from 'ionicons';
import { add, alertCircle, chevronBack, chevronForward, receiptOutline, closeCircle, repeat, search, settingsOutline } from 'ionicons/icons';
import { CATEGORIES, PAYMENTS, categoryOf } from '../../core/catalog';
import { addMonths, dayKey, dayLabel, daysBetween, monthKey, monthLabel, monthRange, parseDay } from '../../core/dates';
import { db, type Expense } from '../../core/db';
import { inr, inrExactly } from '../../core/format';
import { liveBy } from '../../core/live';
import { SettingsService } from '../../core/settings.service';
import { isIn, perDayLeft, totals } from '../../core/money';
import { HAS_FIT } from '../../core/variant';
import { ActionsService } from '../../shared/actions.service';
import { ChartComponent } from '../../shared/chart.component';

@Component({
  selector: 'fw-money',
  imports: [RouterLink, ChartComponent, IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonFab, IonFabButton, IonButtons, IonButton],
  templateUrl: './money.page.html',
  styleUrl: './money.page.scss',
})
export class MoneyPage {
  protected readonly act = inject(ActionsService);
  private readonly settings = inject(SettingsService);
  protected readonly inr = inr;
  protected readonly inrExactly = inrExactly;
  protected readonly categoryOf = categoryOf;
  protected readonly dayLabel = dayLabel;

  protected readonly month = signal(monthKey(dayKey()));
  protected readonly isThisMonth = computed(() => this.month() === monthKey(dayKey()));
  protected readonly title = computed(() => monthLabel(this.month()));
  protected readonly budget = computed(() => this.settings.goals().budget);
  /** In Wallet this is the first screen: it greets you and leads to Settings. */
  protected readonly home = !HAS_FIT;
  protected readonly greeting = computed(() => {
    const name = this.settings.profile().name.split(' ')[0];
    return name ? `${name}'s money` : 'Your money';
  });

  /** This month's expenses plus five months before, for the trend. */
  private readonly rows = liveBy(this.month, (m) => {
    const from = monthRange(addMonths(m, -5)).from;
    const to = monthRange(m).to;
    return db.expenses.where('date').between(from, to, true, true).toArray();
  }, [] as Expense[]);

  protected readonly expenses = computed(() => {
    const { from, to } = monthRange(this.month());
    return this.rows().filter((e) => e.date >= from && e.date <= to)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  });
  private readonly sums = computed(() => totals(this.expenses()));
  protected readonly total = computed(() => this.sums().spent);
  protected readonly got = computed(() => this.sums().got);
  protected readonly isIn = isIn;
  /** "₹937 a day" for the rest of this month, while there is budget left. */
  protected readonly perDay = computed(() => (this.isThisMonth() ? perDayLeft(this.budget(), this.total(), dayKey()) : null));

  /** The list can be narrowed: by words (shop, note, category) and by tapping a category above. */
  protected readonly query = signal('');
  protected readonly onlyCategory = signal<string | null>(null);
  protected readonly searching = computed(() => !!this.query().trim() || !!this.onlyCategory());
  private readonly shown = computed(() => {
    const words = this.query().trim().toLowerCase().split(/\s+/).filter(Boolean);
    const only = this.onlyCategory();
    return this.expenses().filter((e) => {
      if (only && (isIn(e) || e.category !== only)) return false;
      if (!words.length) return true;
      const text = `${e.merchant ?? ''} ${e.note ?? ''} ${categoryOf(e.category, isIn(e)).label} ${this.paymentLabel(e)} ${e.amount}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
  });
  protected readonly shownTotal = computed(() => totals(this.shown()));
  protected readonly groupsCount = computed(() => this.shown().length);

  protected readonly byCategory = computed(() => {
    const sums = new Map<string, { total: number; count: number }>();
    for (const e of this.expenses()) {
      if (isIn(e)) continue;
      const s = sums.get(e.category) ?? { total: 0, count: 0 };
      sums.set(e.category, { total: s.total + e.amount, count: s.count + 1 });
    }
    const rows = CATEGORIES.filter((c) => sums.has(c.key))
      .map((c) => ({ ...c, ...sums.get(c.key)! }))
      .sort((a, b) => b.total - a.total);
    const max = rows[0]?.total ?? 1;
    const total = this.total() || 1;
    return rows.map((r) => ({ ...r, width: (r.total / max) * 100, share: Math.round((r.total / total) * 100) }));
  });

  protected readonly daily = computed(() => {
    const { from, to } = monthRange(this.month());
    const end = this.isThisMonth() ? dayKey() : to;
    const byDay = new Map<string, number>();
    for (const e of this.expenses()) if (!isIn(e)) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.amount);
    const days = daysBetween(from, end);
    return { labels: days.map((d) => String(parseDay(d).getDate())), values: days.map((d) => Math.round(byDay.get(d) ?? 0)) };
  });

  protected readonly trend = computed(() => {
    const months = Array.from({ length: 6 }, (_, i) => addMonths(this.month(), i - 5));
    const sums = new Map<string, number>();
    for (const e of this.rows()) if (!isIn(e)) sums.set(monthKey(e.date), (sums.get(monthKey(e.date)) ?? 0) + e.amount);
    return {
      labels: months.map((m) => parseDay(`${m}-01`).toLocaleDateString('en-IN', { month: 'short' })),
      values: months.map((m) => Math.round(sums.get(m) ?? 0)),
    };
  });

  protected readonly groups = computed(() => {
    const out: { date: string; total: number; items: Expense[] }[] = [];
    for (const e of this.shown()) {
      const spent = isIn(e) ? 0 : e.amount;
      const last = out[out.length - 1];
      if (last?.date === e.date) {
        last.items.push(e);
        last.total += spent;
      } else {
        out.push({ date: e.date, total: spent, items: [e] });
      }
    }
    return out;
  });

  constructor() {
    addIcons({ add, chevronBack, chevronForward, receiptOutline, alertCircle, settingsOutline, search, closeCircle, repeat });
  }

  protected move(n: number): void {
    const next = addMonths(this.month(), n);
    if (next <= monthKey(dayKey())) this.month.set(next);
    this.onlyCategory.set(null);
  }

  protected toggleCategory(key: string): void {
    this.onlyCategory.set(this.onlyCategory() === key ? null : key);
  }

  protected clearSearch(): void {
    this.query.set('');
    this.onlyCategory.set(null);
  }

  protected pct(value: number, max: number): number {
    return max > 0 ? Math.min(100, (value / max) * 100) : 0;
  }

  protected paymentLabel(e: Expense): string {
    return isIn(e) ? 'Money in' : PAYMENTS.find((p) => p.key === e.payment)?.label ?? '';
  }

  protected edit(e: Expense): void {
    this.act.addExpense({ expense: e });
  }
}
