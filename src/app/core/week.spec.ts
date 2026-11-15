import { describe, expect, it } from 'vitest';
import { weekSummary } from './week';

describe('this week', () => {
  const base = { from: '2026-11-09', to: '2026-11-15', food: [], steps: [], workouts: [], water: [], weights: [], routine: [] };

  it('averages only the days something was logged', () => {
    const s = weekSummary({
      ...base,
      food: [{ date: '2026-11-10', kcal: 1800, protein: 60 }, { date: '2026-11-11', kcal: 2000, protein: 80 },
        { date: '2026-11-12', kcal: 2200, protein: 100 }, { date: '2026-11-13', kcal: 0, protein: 0 }],
      steps: [{ date: '2026-11-10', steps: 6000, source: 'manual' }, { date: '2026-11-11', steps: 10000, source: 'manual' }],
      water: [{ date: '2026-11-10', ml: 2000 }, { date: '2026-11-11', ml: 1500 }],
    });
    expect([s.kcalAvg, s.proteinAvg, s.kcalDays, s.stepsAvg, s.waterAvgMl]).toEqual([2000, 80, 3, 8000, 1750]);
  });

  it('counts workouts, weight change and routine; ignores other weeks', () => {
    const s = weekSummary({
      ...base,
      workouts: [{ date: '2026-11-10', type: 'run', minutes: 30, kcal: 300, createdAt: 1 }, { date: '2026-11-14', type: 'gym', minutes: 45, kcal: 250, createdAt: 2 },
        { date: '2026-11-01', type: 'gym', minutes: 60, kcal: 300, createdAt: 3 }],
      weights: [{ date: '2026-11-15', kg: 77.2, createdAt: 2 }, { date: '2026-11-09', kg: 78, createdAt: 1 }, { date: '2026-10-01', kg: 82, createdAt: 0 }],
      routine: [{ done: 2, total: 4 }, { done: 4, total: 4 }],
    });
    expect([s.workouts, s.workoutMinutes, s.weightChange, s.routinePct]).toEqual([2, 75, -0.8, 75]);
  });

  it('an empty week says nothing rather than zero', () => {
    const s = weekSummary(base);
    expect([s.kcalAvg, s.stepsAvg, s.waterAvgMl, s.weightChange, s.routinePct, s.workouts]).toEqual([null, null, null, null, null, 0]);
  });
});
