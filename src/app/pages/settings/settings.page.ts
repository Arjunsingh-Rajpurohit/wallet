import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonInput, IonInputPasswordToggle, IonSelect,
  IonSelectOption, IonSpinner, IonTitle, IonToggle, IonToolbar, NavController,
} from '@ionic/angular';
import { AiService } from '../../core/ai.service';
import { Capacitor } from '@capacitor/core';
import { BackupService } from '../../core/backup.service';
import { dayKey } from '../../core/dates';
import { db } from '../../core/db';
import { DriveService } from '../../core/drive.service';
import { num } from '../../core/format';
import { ACTIVITY_LEVELS, DEFAULT_PROFILE, DIETS, GOALS, suggestedCalories, suggestedProtein, type Profile } from '../../core/profile';
import { DEFAULT_AI_MODEL, SettingsService } from '../../core/settings.service';
import { StepsSyncService } from '../../core/steps-sync.service';
import { logWeight } from '../../core/store';
import { APP_NAME, HAS_FIT, HAS_MONEY, HOME } from '../../core/variant';
import { ActionsService } from '../../shared/actions.service';

const NUMERIC: (keyof Profile)[] = ['birthYear', 'heightCm', 'goalWeightKg', 'calorieGoal', 'proteinGoal', 'stepGoal', 'monthlyBudget'];

@Component({
  selector: 'fw-settings',
  imports: [
    FormsModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonContent, IonInput,
    IonInputPasswordToggle, IonSelect, IonSelectOption, IonToggle, IonSpinner,
  ],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
})
export class SettingsPage implements OnInit {
  protected readonly settings = inject(SettingsService);
  protected readonly stepsSync = inject(StepsSyncService);
  private readonly ai = inject(AiService);
  private readonly backup = inject(BackupService);
  private readonly act = inject(ActionsService);
  private readonly nav = inject(NavController);

  protected readonly drive = inject(DriveService);
  protected readonly hasFit = HAS_FIT;
  protected readonly hasMoney = HAS_MONEY;
  protected readonly appName = APP_NAME;
  protected readonly home = HOME;
  protected readonly native = Capacitor.isNativePlatform();
  protected readonly num = num;
  protected readonly activities = ACTIVITY_LEVELS;
  protected readonly goalsList = GOALS;
  protected readonly diets = DIETS;
  protected readonly thisYear = new Date().getFullYear();

  protected readonly draft = signal<Profile>(DEFAULT_PROFILE);
  protected readonly weight = signal<number | null>(null);
  private savedWeight: number | null = null;

  protected readonly aiKey = signal('');
  protected readonly aiModel = signal(DEFAULT_AI_MODEL);
  protected readonly testing = signal(false);
  protected readonly aiStatus = signal<{ ok: boolean; text: string } | null>(null);
  protected readonly showAdvanced = signal(false);
  protected readonly working = signal(false);

  protected readonly suggested = computed(() => ({
    kcal: suggestedCalories(this.draft(), this.weight()),
    protein: suggestedProtein(this.draft(), this.weight()),
  }));

  async ngOnInit(): Promise<void> {
    this.draft.set(await this.settings.profileNow());
    const ai = await this.settings.aiNow();
    this.aiKey.set(ai.key);
    this.aiModel.set(ai.model);
    this.savedWeight = (await db.weights.orderBy('date').last())?.kg ?? null;
    this.weight.set(this.savedWeight);
    if (this.native && HAS_FIT) this.stepsSync.check();
  }

  protected set<K extends keyof Profile>(key: K, value: unknown): void {
    const v = NUMERIC.includes(key) ? (value === '' || value === null || value === undefined ? null : Number(value)) : value;
    this.draft.update((p) => ({ ...p, [key]: v }));
  }

  protected async save(): Promise<void> {
    const p = this.draft();
    const clean: Profile = {
      ...p,
      name: (p.name ?? '').trim().slice(0, 40),
      calorieGoal: p.calorieGoal || DEFAULT_PROFILE.calorieGoal,
      proteinGoal: p.proteinGoal || DEFAULT_PROFILE.proteinGoal,
      stepGoal: p.stepGoal || DEFAULT_PROFILE.stepGoal,
      monthlyBudget: p.monthlyBudget && p.monthlyBudget > 0 ? p.monthlyBudget : null,
    };
    await this.settings.saveProfile(clean);
    const kg = Number(this.weight());
    if (HAS_FIT && kg >= 20 && kg <= 400 && kg !== this.savedWeight) await logWeight(dayKey(), Math.round(kg * 10) / 10);
    await this.settings.saveAi({ key: this.aiKey(), model: this.aiModel() });
    await this.act.toast('Saved');
    this.nav.back();
  }

  protected async testAi(): Promise<void> {
    this.testing.set(true);
    this.aiStatus.set(null);
    try {
      await this.ai.test(this.aiKey().trim(), this.aiModel().trim() || DEFAULT_AI_MODEL);
      await this.settings.saveAi({ key: this.aiKey(), model: this.aiModel() });
      this.aiStatus.set({ ok: true, text: 'Works! Photo reading is on.' });
    } catch (e) {
      this.aiStatus.set({ ok: false, text: (e as Error).message });
    } finally {
      this.testing.set(false);
    }
  }

  protected openAiStudio(): void {
    window.open('https://aistudio.google.com/apikey', '_blank');
  }

  protected async connectSteps(): Promise<void> {
    try {
      if (await this.stepsSync.connect()) {
        const n = await this.stepsSync.sync(30);
        await this.act.toast(`Connected — ${n} days of steps added`);
      }
    } catch (e) {
      await this.act.toast((e as Error).message, 'error');
    }
  }

  protected when(at: number): string {
    return new Date(at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  }

  protected async connectDrive(): Promise<void> {
    try {
      await this.drive.connect();
      this.draft.set(await this.settings.profileNow());
      await this.act.toast('Google Drive copy is on');
    } catch (e) {
      await this.act.toast((e as Error).message, 'error');
    }
  }

  protected async syncDrive(): Promise<void> {
    try {
      await this.drive.sync(true);
      this.draft.set(await this.settings.profileNow());
      await this.act.toast('Up to date');
    } catch (e) {
      await this.act.toast((e as Error).message, 'error');
    }
  }

  protected async exportData(): Promise<void> {
    this.working.set(true);
    try {
      await this.backup.export();
    } catch (e) {
      await this.act.toast(`Backup failed: ${(e as Error).message}`, 'error');
    } finally {
      this.working.set(false);
    }
  }

  protected async importData(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!(await this.act.confirm('Restore backup?', 'Everything in the app now is replaced by the backup.', 'Restore'))) return;
    try {
      const n = await this.backup.import(await file.text());
      this.draft.set(await this.settings.profileNow());
      await this.act.toast(`Restored ${num(n)} entries`);
    } catch (e) {
      await this.act.toast((e as Error).message, 'error');
    }
  }
}
