import { Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { liveQuery } from 'dexie';
import { from, switchMap } from 'rxjs';

/**
 * A signal that re-runs its database query whenever the tables it read change,
 * so every screen stays current after any save — no manual refresh anywhere.
 * Call from an injection context (a field initializer).
 */
export function live<T>(query: () => Promise<T>, initial: T): Signal<T> {
  return toSignal(from(liveQuery(query)), { initialValue: initial });
}

/** Same, for a query that depends on another signal (the chosen day, month, range…). */
export function liveBy<A, T>(source: Signal<A>, query: (arg: A) => Promise<T>, initial: T): Signal<T> {
  return toSignal(
    toObservable(source).pipe(switchMap((arg) => from(liveQuery(() => query(arg))))),
    { initialValue: initial },
  );
}
