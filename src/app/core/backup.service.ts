import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { dayKey } from './dates';
import { db } from './db';
import { APP, APP_NAME, TABLES } from './variant';

interface BackupFile {
  app: string;
  version: 1;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

/** A FitWallet backup holds both halves, so Fit and Wallet can each take their part of it. */
const KNOWN_APPS = ['fitwallet', 'fit', 'wallet'];
const NOT_OURS = `That file is not a ${APP_NAME} backup.`;

/**
 * Everything the app knows, as one JSON file: saved by hand (Settings → Save backup) or kept in
 * the person's own Google Drive. Photos and videos stay on the phone and are not part of it.
 */
@Injectable({ providedIn: 'root' })
export class BackupService {
  /** True while a backup is being put back, so those writes are not mistaken for new entries. */
  restoring = false;

  async snapshot(): Promise<string> {
    const tables: Record<string, unknown[]> = {};
    for (const name of TABLES) {
      const rows = await db.table(name).toArray();
      // The AI key is personal — never put it in a file that gets shared.
      tables[name] = name === 'settings' ? rows.filter((r) => r.key !== 'ai') : rows;
    }
    const file: BackupFile = { app: APP === 'both' ? 'fitwallet' : APP, version: 1, exportedAt: new Date().toISOString(), tables };
    return JSON.stringify(file);
  }

  /** Nothing logged and no name yet: a fresh install. */
  async isEmpty(): Promise<boolean> {
    for (const name of TABLES) {
      if (name !== 'settings' && (await db.table(name).count()) > 0) return false;
    }
    const profile = (await db.settings.get('profile'))?.value as { name?: string } | undefined;
    return !profile?.name;
  }

  async export(): Promise<void> {
    await this.saveFile(`${APP_NAME.toLowerCase()}-backup-${dayKey()}.json`, await this.snapshot(), 'application/json');
  }

  /** Hands a file to the person: a download in the browser, the share sheet in the phone app. */
  async saveFile(name: string, text: string, mime: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: mime }));
      a.download = name;
      a.click();
      return;
    }
    const saved = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: name, files: [saved.uri] });
  }

  /**
   * Replaces this app's data with the backup's. Only the tables that are both in the file and
   * this app's own are touched. Returns the number of rows restored.
   */
  async import(text: string): Promise<number> {
    let file: BackupFile;
    try {
      file = JSON.parse(text);
    } catch {
      throw new Error(NOT_OURS);
    }
    if (!file || !KNOWN_APPS.includes(file.app) || !file.tables) throw new Error(NOT_OURS);
    const names = TABLES.filter((t) => Array.isArray(file.tables[t]));
    if (!names.some((t) => t !== 'settings')) throw new Error(`That backup has nothing for ${APP_NAME}.`);

    let count = 0;
    this.restoring = true;
    try {
      await db.transaction('rw', names.map((t) => db.table(t)), async () => {
        for (const name of names) {
          const rows = file.tables[name];
          const table = db.table(name);
          if (name === 'settings') {
            // Keep this phone's AI key; take everything else from the backup.
            await table.where('key').notEqual('ai').delete();
          } else {
            await table.clear();
          }
          await table.bulkPut(name === 'settings' ? rows.filter((r: any) => r.key !== 'ai') : rows);
          count += rows.length;
        }
      });
    } finally {
      this.restoring = false;
    }
    return count;
  }
}
