import { describe, it, expect } from 'vitest';
import { generateSetlist, swapTrack, restage, CORE_BUCKETS } from '../src/lib/setlist';
import { EXERCISES, isHoldRx, INTENSITIES } from '../src/data/exercises';
import photoIndex from '../src/data/photos.generated.json';

// Deterministic PRNG so failures are reproducible.
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

describe('generateSetlist', () => {
  it('always returns exactly one push, one core and one lower', () => {
    for (let i = 0; i < 500; i++) {
      const set = generateSetlist({ intensity: 'amplified', rand: lcg(i) });
      expect(set).toHaveLength(3);
      expect(set.map((t) => t.bucket)).toEqual(CORE_BUCKETS);
    }
  });

  it('appends a mobility track when a cooldown is asked for', () => {
    for (let i = 0; i < 100; i++) {
      const set = generateSetlist({ intensity: 'shred', cooldown: true, rand: lcg(i) });
      expect(set).toHaveLength(4);
      expect(set[3]!.bucket).toBe('mobility');
    }
  });

  it('never repeats an exercise inside one setlist', () => {
    for (let i = 0; i < 500; i++) {
      const slugs = generateSetlist({ intensity: 'shred', cooldown: true, rand: lcg(i) }).map((t) => t.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it('rarely serves the same exercise two sessions running', () => {
    let repeats = 0;
    const runs = 400;
    for (let i = 0; i < runs; i++) {
      const rand = lcg(i);
      const first = generateSetlist({ intensity: 'amplified', rand });
      const second = generateSetlist({ intensity: 'amplified', recent: first.map((t) => t.slug), rand });
      if (second.some((t) => first.some((f) => f.slug === t.slug))) repeats++;
    }
    expect(repeats / runs).toBeLessThan(0.1);
  });

  it('does not draw exercises that have no photos', () => {
    const photoless = EXERCISES.filter((e) => !(photoIndex as Record<string, unknown[]>)[e.slug]?.length);
    expect(photoless.length).toBeGreaterThan(0); // crunch, today
    const drawn = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      for (const t of generateSetlist({ intensity: 'amplified', cooldown: true, rand: lcg(i) })) drawn.add(t.slug);
    }
    for (const e of photoless) expect(drawn.has(e.slug)).toBe(false);
  });

  it('carries a usable target and set count for every track', () => {
    for (const intensity of INTENSITIES) {
      for (let i = 0; i < 100; i++) {
        for (const t of generateSetlist({ intensity, cooldown: true, rand: lcg(i) })) {
          expect(t.sets).toBeGreaterThan(0);
          expect(t.target).toBeGreaterThan(0);
          expect(t.restSec).toBeGreaterThan(0);
          expect(t.photos.length).toBeGreaterThan(0);
          expect(isHoldRx(t.rx)).toBe(t.mode === 'hold');
        }
      }
    }
  });

  it('gets harder as intensity climbs', () => {
    for (const e of EXERCISES) {
      const [u, a, s] = INTENSITIES.map((i) => e.rx[i]);
      const vol = (rx: typeof u) => rx.sets * (isHoldRx(rx) ? rx.seconds : rx.reps);
      expect(vol(a)).toBeGreaterThan(vol(u));
      expect(vol(s)).toBeGreaterThan(vol(a));
    }
  });
});

describe('swapTrack', () => {
  it('stays inside the same bucket and changes the exercise', () => {
    for (let i = 0; i < 300; i++) {
      const rand = lcg(i);
      for (const t of generateSetlist({ intensity: 'amplified', cooldown: true, rand })) {
        const swapped = swapTrack(t, 'amplified', [], rand);
        expect(swapped.bucket).toBe(t.bucket);
        expect(swapped.slug).not.toBe(t.slug);
      }
    }
  });
});

describe('restage', () => {
  it('keeps the exercises but reprices them', () => {
    const set = generateSetlist({ intensity: 'unplugged', rand: lcg(7) });
    const harder = restage(set, 'shred');
    expect(harder.map((t) => t.slug)).toEqual(set.map((t) => t.slug));
    expect(harder.reduce((n, t) => n + t.sets * t.target, 0))
      .toBeGreaterThan(set.reduce((n, t) => n + t.sets * t.target, 0));
  });
});

describe('catalog integrity', () => {
  it('has unique slugs', () => {
    expect(new Set(EXERCISES.map((e) => e.slug)).size).toBe(EXERCISES.length);
  });
  it('fills in every field the UI renders', () => {
    for (const e of EXERCISES) {
      expect(e.real).toBeTruthy();
      expect(e.stage).toBeTruthy();
      expect(e.band).toBeTruthy();
      expect(e.muscles.length).toBeGreaterThan(0);
      expect(e.cues.length).toBeGreaterThanOrEqual(3);
      for (const i of INTENSITIES) expect(e.rx[i]).toBeTruthy();
    }
  });
  it('keeps every bucket stocked', () => {
    for (const b of [...CORE_BUCKETS, 'mobility' as const]) {
      expect(EXERCISES.filter((e) => e.bucket === b).length).toBeGreaterThanOrEqual(5);
    }
  });
  it('points every generated photo at a real catalog slug', () => {
    const slugs = new Set(EXERCISES.map((e) => e.slug));
    for (const slug of Object.keys(photoIndex)) expect(slugs.has(slug)).toBe(true);
  });
});
