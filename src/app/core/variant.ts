/**
 * One codebase, three apps: FitWallet (the Android app, both halves), Fit and Wallet (the two
 * websites). The website repos are copies of this one with only APP changed.
 */
export type AppKind = 'both' | 'fit' | 'wallet';

export const APP = 'wallet' as AppKind;

export const HAS_FIT = APP !== 'wallet';
export const HAS_MONEY = APP !== 'fit';
export const APP_NAME = APP === 'fit' ? 'Fit' : APP === 'wallet' ? 'Wallet' : 'FitWallet';
/** Both websites share one address (github.io), so each keeps its own database. */
export const DB_NAME = APP === 'both' ? 'fitwallet' : `${APP}-app`;
export const HOME = HAS_FIT ? '/tabs/today' : '/tabs/money';

/** The tables this app owns; "settings" (name, goals, budget) belongs to all. */
export const TABLES: readonly string[] = [
  ...(HAS_FIT ? ['meals', 'weights', 'steps', 'workouts', 'habits', 'habitChecks', 'progress', 'water'] : []),
  ...(HAS_MONEY ? ['expenses'] : []),
  'settings',
];

/**
 * "Sign in with Google" keeps a copy of your data in your own Google Drive. It needs a free
 * Google client id (see README → Google Drive); while this is empty the option stays hidden.
 */
export const GOOGLE_CLIENT_ID = '';
