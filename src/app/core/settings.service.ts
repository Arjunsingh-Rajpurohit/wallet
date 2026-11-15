import { Injectable, computed } from '@angular/core';
import { db, type WeightEntry } from './db';
import { live } from './live';
import { DEFAULT_PROFILE, goalsFor, type Profile } from './profile';
import { HAS_FIT } from './variant';

export interface AiSettings {
  key: string;
  model: string;
}

/** Gemini's own alias for its newest Flash model, so a model retirement never breaks the app. */
export const DEFAULT_AI_MODEL = 'gemini-flash-latest';

async function read<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? ({ ...fallback, ...(row.value as Partial<T>) } as T) : fallback;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly profile = live(() => read<Profile>('profile', DEFAULT_PROFILE), DEFAULT_PROFILE);
  readonly ai = live(() => read<AiSettings>('ai', { key: '', model: DEFAULT_AI_MODEL }), { key: '', model: DEFAULT_AI_MODEL });
  readonly latestWeight = live(() => db.weights.orderBy('date').last(), undefined as WeightEntry | undefined);

  readonly goals = computed(() => goalsFor(this.profile(), this.latestWeight()?.kg ?? null));
  readonly aiReady = computed(() => this.ai().key.trim().length > 0);
  readonly needsSetup = computed(() => {
    const p = this.profile();
    return HAS_FIT && (!p.name || !p.sex || !p.birthYear || !p.heightCm);
  });

  saveProfile(profile: Profile): Promise<unknown> {
    return db.settings.put({ key: 'profile', value: profile });
  }

  saveAi(ai: AiSettings): Promise<unknown> {
    return db.settings.put({ key: 'ai', value: { key: ai.key.trim(), model: ai.model.trim() || DEFAULT_AI_MODEL } });
  }

  profileNow(): Promise<Profile> {
    return read<Profile>('profile', DEFAULT_PROFILE);
  }

  /** Read once, outside a template — for services that act on the current values. */
  aiNow(): Promise<AiSettings> {
    return read<AiSettings>('ai', { key: '', model: DEFAULT_AI_MODEL });
  }
}
