import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';
import { addDays, dayKey, parseDay } from './dates';
import { db } from './db';

export type StepsLink = 'unknown' | 'unavailable' | 'needs-permission' | 'connected';

/**
 * Reads daily step totals from Health Connect — whatever already counts your steps
 * (Google Fit, Samsung Health, a watch) writes them there. Read-only, never written back.
 */
@Injectable({ providedIn: 'root' })
export class StepsSyncService {
  readonly link = signal<StepsLink>('unknown');
  readonly reason = signal('');

  async check(): Promise<StepsLink> {
    if (!Capacitor.isNativePlatform()) return this.setLink('unavailable', 'Step syncing works in the phone app.');
    try {
      const availability = await Health.isAvailable();
      if (!availability.available) {
        return this.setLink('unavailable', 'Health Connect is not on this phone. Install "Health Connect" from the Play Store, or type steps yourself.');
      }
      const status = await Health.checkAuthorization({ read: ['steps'] });
      return this.setLink(status.readAuthorized.includes('steps') ? 'connected' : 'needs-permission', '');
    } catch (e) {
      return this.setLink('unavailable', String((e as Error)?.message ?? e));
    }
  }

  async connect(): Promise<boolean> {
    const status = await Health.requestAuthorization({ read: ['steps'] });
    const ok = status.readAuthorized.includes('steps');
    this.setLink(ok ? 'connected' : 'needs-permission', ok ? '' : 'Steps permission was not given.');
    return ok;
  }

  /** Pulls the last `days` days (Health Connect keeps 30 without extra permission). Returns days updated. */
  async sync(days = 30): Promise<number> {
    if ((await this.check()) !== 'connected') return 0;
    const today = dayKey();
    const start = parseDay(addDays(today, -(days - 1)));
    start.setHours(0, 0, 0, 0);
    const result = await Health.queryAggregated({
      dataType: 'steps', bucket: 'day', aggregation: 'sum',
      startDate: start.toISOString(), endDate: new Date().toISOString(),
    });
    const rows = result.samples
      .map((s) => ({ date: dayKey(new Date(s.startDate)), steps: Math.round(s.value) }))
      .filter((r) => r.steps > 0);

    // A step count you typed yourself is kept unless the phone counted more.
    const existing = new Map((await db.steps.bulkGet(rows.map((r) => r.date))).filter(Boolean).map((e) => [e!.date, e!]));
    const updates = rows
      .filter((r) => { const old = existing.get(r.date); return !old || old.source === 'phone' || r.steps > old.steps; })
      .map((r) => ({ ...r, source: 'phone' as const }));
    await db.steps.bulkPut(updates);
    return updates.length;
  }

  private setLink(link: StepsLink, reason: string): StepsLink {
    this.link.set(link);
    this.reason.set(reason);
    return link;
  }
}
