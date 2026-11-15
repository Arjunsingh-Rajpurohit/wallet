import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertController } from '@ionic/angular/alert-controller';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonInput } from '@ionic/angular/ion-input';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { ToastController } from '@ionic/angular/toast-controller';
import { BillScanService } from '../../core/bill-scan.service';
import { CATEGORIES, INCOME_CATEGORIES, PAYMENTS } from '../../core/catalog';
import { dayKey } from '../../core/dates';
import type { DayKey, Expense, ExpenseCategory, PaymentMethod } from '../../core/db';
import { inr, newId } from '../../core/format';
import { isIn } from '../../core/money';
import { MediaService, MediaSrcDirective, type MediaSource } from '../../core/media.service';
import { addExpense, deleteExpense, stopSeries, updateExpense } from '../../core/store';

@Component({
  selector: 'fw-expense',
  imports: [FormsModule, MediaSrcDirective, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonInput, IonSpinner],
  templateUrl: './expense.modal.html',
  styleUrl: './expense.modal.scss',
})
export class ExpenseModal implements OnInit {
  @Input() date: DayKey = dayKey();
  @Input() expense?: Expense;
  @Input() scan?: MediaSource;

  private readonly modalCtrl = inject(ModalController);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly media = inject(MediaService);
  private readonly bills = inject(BillScanService);

  protected readonly moneyIn = signal(false);
  protected readonly categories = computed(() => (this.moneyIn() ? INCOME_CATEGORIES : CATEGORIES));
  protected readonly repeat = signal(false);
  protected readonly dayOfMonth = computed(() => {
    const d = Number((this.when() || this.today).slice(8));
    return `${d}${d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th'}`;
  });
  protected readonly payments = PAYMENTS;
  protected readonly today = dayKey();

  protected readonly amount = signal<number | null>(null);
  protected readonly category = signal<ExpenseCategory>('food');
  protected readonly merchant = signal('');
  protected readonly payment = signal<PaymentMethod>('upi');
  protected readonly when = signal<DayKey>(dayKey());
  protected readonly note = signal('');
  protected readonly bill = signal<string | null>(null);
  protected readonly reading = signal(false);
  protected readonly readNote = signal('');
  protected readonly readError = signal('');
  private originalBill?: string;

  async ngOnInit(): Promise<void> {
    const e = this.expense;
    this.when.set(e?.date ?? this.date);
    if (e) {
      this.amount.set(e.amount);
      this.moneyIn.set(isIn(e));
      this.repeat.set(!!e.repeat);
      this.category.set(e.category);
      this.merchant.set(e.merchant ?? '');
      this.payment.set(e.payment);
      this.note.set(e.note ?? '');
      this.bill.set(e.bill ?? null);
      this.originalBill = e.bill;
    }
    if (this.scan) await this.addBill(this.scan);
  }

  protected setKind(moneyIn: boolean): void {
    if (moneyIn === this.moneyIn()) return;
    this.moneyIn.set(moneyIn);
    this.category.set(moneyIn ? 'salary' : 'food');
  }

  protected async addBill(source: MediaSource): Promise<void> {
    this.readError.set('');
    try {
      const saved = await this.media.photo(source, 'bills');
      if (!saved) return;
      await this.dropUnsavedBill();
      this.bill.set(saved.path);
      await this.readBill();
    } catch (e) {
      this.readError.set((e as Error).message);
    }
  }

  protected async readBill(): Promise<void> {
    const path = this.bill();
    if (!path) return;
    this.reading.set(true);
    this.readError.set('');
    try {
      const r = await this.bills.read(path);
      if (r.total) this.amount.set(r.total);
      if (r.merchant) this.merchant.set(r.merchant);
      if (r.date) this.when.set(r.date);
      if (r.payment) this.payment.set(r.payment);
      this.category.set(r.category);
      this.readNote.set(`${r.readBy === 'ai' ? '✨ Read by AI' : '📱 Read on your phone'} — ${r.note || 'check the amount before saving.'}`);
    } catch (e) {
      this.readError.set((e as Error).message);
    } finally {
      this.reading.set(false);
    }
  }

  protected async removeBill(): Promise<void> {
    await this.dropUnsavedBill();
    this.bill.set(null);
    this.readNote.set('');
  }

  protected async save(): Promise<void> {
    const amount = Math.round(Number(this.amount()) * 100) / 100;
    if (!(amount > 0)) return;
    const date = this.when() || this.today;
    const moneyIn = this.moneyIn();
    const data = {
      date, amount, category: this.category(), payment: this.payment(),
      merchant: this.merchant().trim() || undefined, note: this.note().trim() || undefined,
      bill: moneyIn ? undefined : this.bill() ?? undefined,
      kind: moneyIn ? ('in' as const) : undefined,
      // Ticking Repeat starts a series (or carries the old one on); unticking ends it here.
      repeat: this.repeat() || undefined,
      series: this.repeat() ? this.expense?.series ?? newId() : this.expense?.series,
      repeatDay: this.repeat() ? Number(date.slice(8)) : undefined,
    };
    if (this.expense?.id) {
      if (this.expense.series && !this.repeat()) await stopSeries(this.expense.series);
      await updateExpense(this.expense.id, data);
      // The old bill photo was replaced or removed.
      if (this.originalBill && this.originalBill !== data.bill) await this.media.remove(this.originalBill);
    } else {
      await addExpense(data);
    }
    await this.toast(`Saved ${inr(amount)}`);
    await this.modalCtrl.dismiss(true);
  }

  protected async remove(): Promise<void> {
    if (!this.expense?.id) return;
    const a = await this.alerts.create({
      header: 'Delete this?',
      message: `${inr(this.expense.amount)} will be removed.${this.expense.repeat ? ' It also stops repeating.' : ''}`,
      buttons: [{ text: 'Cancel', role: 'cancel' }, { text: 'Delete', role: 'confirm' }],
    });
    await a.present();
    if ((await a.onDidDismiss()).role !== 'confirm') return;
    if (this.expense.series) await stopSeries(this.expense.series);
    await deleteExpense(this.expense.id);
    await this.media.remove(this.originalBill, this.bill() ?? undefined);
    await this.modalCtrl.dismiss(true);
  }

  protected async cancel(): Promise<void> {
    await this.dropUnsavedBill();
    await this.modalCtrl.dismiss(false);
  }

  /** A bill photo taken in this visit but not saved yet is thrown away. */
  private async dropUnsavedBill(): Promise<void> {
    const current = this.bill();
    if (current && current !== this.originalBill) await this.media.remove(current);
  }

  private async toast(message: string): Promise<void> {
    const t = await this.toasts.create({ message, duration: 1500, color: 'dark' });
    await t.present();
  }
}
