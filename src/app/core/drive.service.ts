import { Injectable, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { BackupService } from './backup.service';
import { db } from './db';
import { DRIVE_SCOPE, DriveError, findFile, nextStep, readFile, writeFile } from './drive-sync';
import { APP, DB_NAME, GOOGLE_CLIENT_ID, TABLES } from './variant';

interface Kept {
  on: boolean;
  /** Drive's modified time as this phone last saw (or wrote) it. */
  seen?: string;
  /** When this phone last changed something, and when it last sent its copy. */
  changed?: number;
  sent?: number;
  /** When the two last agreed — shown in Settings. */
  at?: number;
}

interface TokenClient {
  requestAccessToken(o: { prompt: string }): void;
}

const KEY = `${DB_NAME}.drive`;
const TOKEN_KEY = `${DB_NAME}.drive.token`;
const FILE = `${APP === 'both' ? 'fitwallet' : APP}-data.json`;

/**
 * "Sign in with Google": a copy of the data in the person's own Google Drive, so a new phone
 * (or a cleared browser) gets everything back. Nobody else — not the app's maker — can read it.
 */
@Injectable({ providedIn: 'root' })
export class DriveService {
  private readonly backup = inject(BackupService);

  /** Offered on the website once a Google client id is set. */
  readonly available = !!GOOGLE_CLIENT_ID && !Capacitor.isNativePlatform();
  readonly on = signal(false);
  readonly busy = signal(false);
  readonly lastAt = signal<number | null>(null);
  readonly problem = signal<string | null>(null);

  /** Asked when this phone and Drive both changed. True = take Drive's copy. */
  ask: (driveDate: Date) => Promise<boolean> = async () => false;

  private kept: Kept = { on: false };
  private client?: Promise<TokenClient>;
  private waiting?: { resolve(token: string): void; reject(e: Error): void };
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;

  start(): void {
    if (!this.available) return;
    try {
      this.kept = { on: false, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
    } catch {
      this.kept = { on: false };
    }
    this.on.set(this.kept.on);
    this.lastAt.set(this.kept.at ?? null);
    for (const name of TABLES) {
      const table = db.table(name);
      table.hook('creating', () => this.changed());
      table.hook('updating', () => this.changed());
      table.hook('deleting', () => this.changed());
    }
    // Google only lets a page ask for access right after a tap, so the first tap of a visit syncs.
    addEventListener('pointerdown', () => {
      if (this.kept.on) void this.sync(false);
    }, { once: true, capture: true });
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && this.kept.on && this.token()) void this.sync(false);
    });
  }

  /** Sign in with Google and bring the two copies together. */
  async connect(): Promise<void> {
    await this.getToken(true);
    this.save({ on: true });
    this.on.set(true);
    await this.sync(true);
  }

  disconnect(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    this.save({ on: false, seen: undefined, sent: undefined, at: undefined });
    this.on.set(false);
    this.lastAt.set(null);
    this.problem.set(null);
  }

  /** `byUser`: pressed in Settings — errors are thrown; otherwise they only show there. */
  sync(byUser: boolean): Promise<void> {
    this.running ??= this.run(byUser).finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  private async run(byUser: boolean): Promise<void> {
    this.busy.set(true);
    try {
      const token = await this.getToken(byUser);
      const remote = await findFile(token, FILE);
      const dirty = (this.kept.changed ?? 0) > (this.kept.sent ?? 0);
      let step = nextStep({ remote, seen: this.kept.seen, dirty, empty: await this.backup.isEmpty() });
      if (step === 'ask') step = (await this.ask(new Date(remote!.modifiedTime))) ? 'pull' : 'push';
      if (step === 'pull') {
        await this.backup.import(await readFile(token, remote!.id));
        this.save({ seen: remote!.modifiedTime, sent: Date.now(), at: Date.now() });
      } else if (step === 'push') {
        const started = Date.now();
        const written = await writeFile(token, FILE, await this.backup.snapshot(), remote?.id ?? null);
        this.save({ seen: written.modifiedTime, sent: started, at: Date.now() });
      } else {
        this.save({ at: Date.now() });
      }
      this.lastAt.set(this.kept.at ?? null);
      this.problem.set(null);
    } catch (e) {
      if (e instanceof DriveError && e.status === 401) sessionStorage.removeItem(TOKEN_KEY);
      this.problem.set((e as Error).message);
      if (byUser) throw e;
    } finally {
      this.busy.set(false);
    }
  }

  private changed(): void {
    if (this.backup.restoring) return;
    this.save({ changed: Date.now() });
    if (!this.kept.on) return;
    clearTimeout(this.timer);
    // A few quiet seconds after the last save, and only while Google's pass is still good.
    this.timer = setTimeout(() => {
      if (this.token()) void this.sync(false);
    }, 4000);
  }

  private save(change: Partial<Kept>): void {
    this.kept = { ...this.kept, ...change };
    try {
      localStorage.setItem(KEY, JSON.stringify(this.kept));
    } catch {
      // Private mode: the copy still works until the page closes.
    }
  }

  /** Google's pass lasts an hour; kept for this tab only. */
  private token(): string | null {
    try {
      const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? 'null') as { token: string; until: number } | null;
      return t && t.until > Date.now() + 60_000 ? t.token : null;
    } catch {
      return null;
    }
  }

  private async getToken(choose: boolean): Promise<string> {
    const have = this.token();
    if (have) return have;
    const client = await this.tokenClient();
    return new Promise<string>((resolve, reject) => {
      this.waiting = { resolve, reject };
      // '' = no questions when access was already given; the first time Google shows its screen.
      client.requestAccessToken({ prompt: choose && !this.kept.on ? 'consent' : '' });
    });
  }

  private tokenClient(): Promise<TokenClient> {
    this.client ??= new Promise<TokenClient>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onerror = () => {
        this.client = undefined;
        reject(new Error('Google could not be reached. Check your internet.'));
      };
      script.onload = () => {
        const google = (globalThis as any).google;
        resolve(google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: DRIVE_SCOPE,
          callback: (r: { access_token?: string; expires_in?: number; error?: string }) => {
            if (!r.access_token) return this.waiting?.reject(new Error('Google sign-in was not finished.'));
            sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token: r.access_token, until: Date.now() + (r.expires_in ?? 3600) * 1000 }));
            this.waiting?.resolve(r.access_token);
          },
          error_callback: () => this.waiting?.reject(new Error('Google sign-in was closed.')),
        }));
      };
      document.head.append(script);
    });
    return this.client;
  }
}
