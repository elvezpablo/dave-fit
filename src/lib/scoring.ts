import { INTENSITY_META, type Intensity } from '../data/exercises';

/** Five seconds of a hold is worth one rep. */
export const HOLD_SECONDS_PER_POINT = 5;

/**
 * Weekly boards reset on Monday 00:00 in this zone. Fixed rather than
 * per-user so everyone is racing the same clock.
 */
export const LEADERBOARD_TZ = 'America/Chicago';

/** Points for a single completed set. */
export function itemPoints(mode: 'reps' | 'hold', actual: number, intensity: Intensity): number {
  if (!Number.isFinite(actual) || actual <= 0) return 0;
  const base = mode === 'hold' ? actual / HOLD_SECONDS_PER_POINT : actual;
  return Math.round(base * INTENSITY_META[intensity].multiplier);
}

/** Civil date (YYYY-MM-DD) in the leaderboard zone. */
export function civilDate(d: Date = new Date(), tz: string = LEADERBOARD_TZ): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** ISO-8601 week key, e.g. "2026-W44". Precomputed so the board is one index lookup. */
export function weekKey(d: Date = new Date(), tz: string = LEADERBOARD_TZ): string {
  const [y, m, day] = civilDate(d, tz).split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, day!));
  // Shift to the Thursday of this ISO week; its calendar year is the ISO year.
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7) + 3);
  const isoYear = dt.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const week1Monday = new Date(Date.UTC(isoYear, 0, 4 - ((jan4.getUTCDay() + 6) % 7)));
  const week = Math.round((dt.getTime() - week1Monday.getTime()) / 604_800_000) + 1;
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/** Day before a YYYY-MM-DD civil date, as YYYY-MM-DD. */
export function previousDay(civil: string): string {
  const [y, m, d] = civil.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! - 1));
  return dt.toISOString().slice(0, 10);
}

/**
 * Streak after finishing a workout on `today`.
 * Same day → unchanged. Yesterday → +1. Anything older (or never) → back to 1.
 */
export function nextStreak(lastWorkoutDate: string | null, today: string, current: number): number {
  if (lastWorkoutDate === today) return Math.max(current, 1);
  if (lastWorkoutDate && lastWorkoutDate === previousDay(today)) return current + 1;
  return 1;
}

/** A streak is only live if it was fed today or yesterday. */
export function liveStreak(lastWorkoutDate: string | null, stored: number, today: string): number {
  if (!lastWorkoutDate) return 0;
  if (lastWorkoutDate === today || lastWorkoutDate === previousDay(today)) return stored;
  return 0;
}

export const RANKS = [
  { min: 0, title: 'Roadie' },
  { min: 500, title: 'Groupie' },
  { min: 1_500, title: 'Garage Band' },
  { min: 4_000, title: 'Club Act' },
  { min: 9_000, title: 'Opening Act' },
  { min: 20_000, title: 'Headliner' },
  { min: 45_000, title: 'Stadium God' },
  { min: 100_000, title: 'Hall of Fame' },
] as const;

export interface Rank {
  title: string;
  index: number;
  points: number;
  next: { title: string; min: number; remaining: number } | null;
  progress: number;
}

export function rankFor(points: number): Rank {
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (points >= RANKS[k]!.min) i = k;
  const cur = RANKS[i]!;
  const nxt = RANKS[i + 1];
  return {
    title: cur.title,
    index: i,
    points,
    next: nxt ? { title: nxt.title, min: nxt.min, remaining: nxt.min - points } : null,
    progress: nxt ? (points - cur.min) / (nxt.min - cur.min) : 1,
  };
}
