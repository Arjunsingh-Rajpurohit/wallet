import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController, IonButton, IonButtons, IonContent, IonHeader, IonInput, IonSpinner, IonTitle, IonToolbar,
  ModalController, ToastController,
} from '@ionic/angular';
import { BillScanService } from '../../core/bill-scan.service';
import { CATEGORIES, PAYMENTS } from '../../core/catalog';
import { dayKey } from '../../core/dates';
import type { DayKey, Expense, ExpenseCategory, PaymentMethod } from '../../core/db';
import { inr } from '../../core/format';
import { MediaService, MediaSrcDirective, type MediaSource } from '../../core/media.service';
import { addExpense, deleteExpense, updateExpense } from '../../core/store';

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

  protected readonly categories = CATEGORIES;
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
      this.category.set(e.category);
      this.merchant.set(e.merchant ?? '');
      this.payment.set(e.payment);
      this.note.set(e.note ?? '');
      this.bill.set(e.bill ?? null);
      this.originalBill = e.bill;
    }
    if (this.scan) await this.addBill(this.scan);
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
    const data = {
      date: this.when() || this.today, amount, category: this.category(), payment: this.payment(),
      merchant: this.merchant().trim() || undefined, note: this.note().trim() || undefined, bill: this.bill() ?? undefined,
    };
    if (this.expense?.id) {
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
      header: 'Delete this expense?', message: `${inr(this.expense.amount)} will be removed.`,
      buttons: [{ text: 'Cancel', role: 'cancel' }, { text: 'Delete', role: 'confirm' }],
    });
    await a.present();
    if ((await a.onDidDismiss()).role !== 'confirm') return;
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
