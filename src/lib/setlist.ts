import {
  EXERCISES,
  BY_SLUG,
  isHoldRx,
  type Bucket,
  type Exercise,
  type Intensity,
  type Rx,
} from '../data/exercises';
import photoIndex from '../data/photos.generated.json';

/** The three buckets that always make up a setlist, in running order. */
export const CORE_BUCKETS: Bucket[] = ['push', 'core', 'lower'];

export interface Track {
  slug: string;
  exercise: Exercise;
  bucket: Bucket;
  rx: Rx;
  mode: 'reps' | 'hold';
  /** Per-set target: reps, or seconds for a hold. */
  target: number;
  sets: number;
  restSec: number;
  photos: string[];
}

const photosFor = (slug: string): string[] =>
  ((photoIndex as Record<string, { stem: string }[]>)[slug] ?? []).map((p) => p.stem);

function toTrack(exercise: Exercise, intensity: Intensity): Track {
  const rx = exercise.rx[intensity];
  return {
    slug: exercise.slug,
    exercise,
    bucket: exercise.bucket,
    rx,
    mode: exercise.mode,
    target: isHoldRx(rx) ? rx.seconds : rx.reps,
    sets: rx.sets,
    restSec: rx.restSec,
    photos: photosFor(exercise.slug),
  };
}

/** An exercise you did recently is heavily penalised, but never impossible. */
function weightOf(e: Exercise, recent: string[]): number {
  const seen = recent.indexOf(e.slug); // 0 = most recent session
  if (seen === 0) return 0.05;
  if (seen === 1) return 0.15;
  if (seen === 2) return 0.4;
  if (seen > 0) return 0.75;
  return 1;
}

/**
 * Only exercises we can actually show. A track with no demo photo is a track
 * you can't follow, so it stays browsable in /exercises but out of setlists —
 * unless a whole bucket is unphotographed, in which case something beats
 * nothing.
 */
function drawable(pool: Exercise[]): Exercise[] {
  const shown = pool.filter((e) => photosFor(e.slug).length > 0);
  return shown.length > 0 ? shown : pool;
}

function weightedPick(pool: Exercise[], recent: string[], rand: () => number): Exercise {
  const weights = pool.map((e) => weightOf(e, recent));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rand() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
}

export interface SetlistOptions {
  intensity: Intensity;
  /** Append a mobility track. */
  cooldown?: boolean;
  /** Slugs from recent sessions, most recent first. */
  recent?: string[];
  rand?: () => number;
}

/** One from push, one from core, one from lower — plus an optional cooldown. */
export function generateSetlist(opts: SetlistOptions): Track[] {
  const { intensity, cooldown = false, recent = [], rand = Math.random } = opts;
  const buckets = cooldown ? [...CORE_BUCKETS, 'mobility' as Bucket] : CORE_BUCKETS;

  return buckets.map((bucket) => {
    const pool = drawable(EXERCISES.filter((e) => e.bucket === bucket));
    return toTrack(weightedPick(pool, recent, rand), intensity);
  });
}

/** Re-roll one track within its own bucket, so the balance survives. */
export function swapTrack(
  current: Track,
  intensity: Intensity,
  recent: string[] = [],
  rand: () => number = Math.random,
): Track {
  const pool = drawable(EXERCISES.filter((e) => e.bucket === current.bucket && e.slug !== current.slug));
  if (pool.length === 0) return current;
  return toTrack(weightedPick(pool, [current.slug, ...recent], rand), intensity);
}

/** Rebuild tracks for a new intensity without changing the exercises. */
export function restage(tracks: Track[], intensity: Intensity): Track[] {
  return tracks.map((t) => toTrack(t.exercise, intensity));
}

export function trackFromSlug(slug: string, intensity: Intensity): Track | null {
  const e = BY_SLUG.get(slug);
  return e ? toTrack(e, intensity) : null;
}
